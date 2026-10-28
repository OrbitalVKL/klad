package app.klad.vault;

import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.ProviderException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.Properties;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/**
 * Coffre de Klad : fichier noBackupFilesDir/klad/coffre.properties et clés Android Keystore.
 *
 * - DEK (clé de données, AES-256) tirée au hasard une seule fois.
 * - Enveloppe « code » : DEK chiffrée par PBKDF2(code), puis chiffrée de nouveau par la clé Keystore
 *   « klad.appareil » (sans authentification, non exportable) : les codes ne peuvent être testés que sur ce téléphone.
 * - Enveloppe « empreinte » : DEK chiffrée par la clé Keystore « klad.empreinte » (empreinte forte exigée à chaque usage,
 *   invalidée si une empreinte est ajoutée).
 * - Compteur de codes faux et heure du dernier essai, dans le même fichier.
 * Les méthodes sont synchronisées : appels du plugin (fil des plugins) et de BiometricPrompt (fil principal).
 */
final class Vault {

    static final String KEY_DEVICE = "klad.appareil";
    static final String KEY_BIO = "klad.empreinte";
    // Lien Grafit : clé SANS authentification du « résumé » lisible appli verrouillée (créée et utilisée par
    // app.klad.grafit.CleKeystore). Le coffre la supprime seulement, avec tout le reste, à l'effacement complet.
    static final String KEY_RESUME = "klad.resume";

    private static final String KS = "AndroidKeyStore";

    /** Résultat d'un essai de code. dek != null si le code est bon. */
    static final class Attempt {
        final byte[] dek;
        final String reason; // null, "code", "attente", "casse"
        final long waitMs;
        final int failures;

        Attempt(byte[] dek, String reason, long waitMs, int failures) {
            this.dek = dek;
            this.reason = reason;
            this.waitMs = waitMs;
            this.failures = failures;
        }
    }

    private final File dir;
    private final File blobs;
    private final AtomicFile file;
    private final SecureRandom rnd = new SecureRandom();
    private Properties p = new Properties();

    Vault(Context ctx) {
        dir = new File(ctx.getNoBackupFilesDir(), "klad");
        blobs = new File(dir, "blocs");
        file = new AtomicFile(new File(dir, "coffre.properties"));
        load();
    }

    // ------------------------------------------------------------ fichier

    private void load() {
        p = new Properties();
        try (FileInputStream in = file.openRead()) {
            p.load(in);
        } catch (IOException e) {
            p = new Properties();
        }
    }

    private void store() throws IOException {
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Dossier du coffre impossible à créer");
        FileOutputStream out = file.startWrite();
        try {
            p.store(out, null);
            file.finishWrite(out);
        } catch (IOException e) {
            file.failWrite(out);
            throw e;
        }
    }

    private byte[] bytes(String k) {
        String v = p.getProperty(k);
        return v == null ? null : Base64.getDecoder().decode(v);
    }

    private void put(String k, byte[] v) {
        p.setProperty(k, Base64.getEncoder().encodeToString(v));
    }

    private int num(String k) {
        try {
            return Integer.parseInt(p.getProperty(k, "0"));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private long time(String k) {
        try {
            return Long.parseLong(p.getProperty(k, "0"));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    synchronized boolean exists() {
        return p.getProperty("enveloppe") != null;
    }

    synchronized int failures() {
        return num("echecs");
    }

    synchronized long waitMs() {
        return Coffre.waitMs(num("echecs"), time("dernier"), System.currentTimeMillis());
    }

    /** "oui", "non" ou "invalidee" (nouvelle empreinte enregistrée sur le téléphone). */
    synchronized String bioState() {
        if ("1".equals(p.getProperty("empreinte.invalidee"))) return "invalidee";
        return p.getProperty("empreinte") != null ? "oui" : "non";
    }

    synchronized boolean strongBox() {
        return "1".equals(p.getProperty("strongbox"));
    }

    // ------------------------------------------------------------ Keystore

    private static KeyStore keyStore() throws GeneralSecurityException, IOException {
        KeyStore ks = KeyStore.getInstance(KS);
        ks.load(null);
        return ks;
    }

    private static SecretKey getKey(String alias) throws GeneralSecurityException, IOException {
        KeyStore.Entry e = keyStore().getEntry(alias, null);
        return e instanceof KeyStore.SecretKeyEntry ? ((KeyStore.SecretKeyEntry) e).getSecretKey() : null;
    }

    private static void deleteKey(String alias) {
        try {
            keyStore().deleteEntry(alias);
        } catch (GeneralSecurityException | IOException ignored) {
            // déjà absente
        }
    }

    /** Clé AES-256-GCM non exportable ; StrongBox si le téléphone en a. Renvoie true si StrongBox. */
    private static boolean newKey(String alias, boolean bio) throws GeneralSecurityException {
        try {
            generate(alias, bio, true);
            return true;
        } catch (ProviderException e) {       // StrongBoxUnavailableException, ou StrongBox refusant ces réglages
            generate(alias, bio, false);
            return false;
        }
    }

    private static void generate(String alias, boolean bio, boolean strongBox) throws GeneralSecurityException {
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setIsStrongBoxBacked(strongBox);
        if (bio) {
            b.setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true);
            if (Build.VERSION.SDK_INT >= 30) b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
            // Android 9 et 10 : sans durée de validité, chaque usage exige une empreinte forte.
        }
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KS);
        g.init(b.build());
        g.generateKey();
    }

    // ------------------------------------------------------------ code

    /** Itérations PBKDF2 pour ≈ 0,5 s sur ce téléphone. */
    private int calibrate() throws GeneralSecurityException {
        char[] probe = "000000".toCharArray();
        byte[] salt = new byte[Coffre.SALT_BYTES];
        Coffre.derive(probe, salt, Coffre.ITER_PROBE); // mise en route
        long t = System.nanoTime();
        Coffre.derive(probe, salt, Coffre.ITER_PROBE);
        return Coffre.calibrate(System.nanoTime() - t);
    }

    /** Écrit l'enveloppe « code » de la DEK (nouvelle clé appareil si besoin, nouveau sel, itérations recalibrées). */
    private void wrapWithPin(byte[] dek, char[] pin) throws GeneralSecurityException, IOException {
        SecretKey device = getKey(KEY_DEVICE);
        if (device == null) {
            p.setProperty("strongbox", newKey(KEY_DEVICE, false) ? "1" : "0");
            device = getKey(KEY_DEVICE);
        }
        int iter = calibrate();
        byte[] salt = new byte[Coffre.SALT_BYTES];
        rnd.nextBytes(salt);
        byte[] inner = Coffre.wrapPin(dek, pin, salt, iter, rnd);
        byte[] outer = Coffre.seal(device, inner, Coffre.AAD_DEVICE, null);
        put("sel", salt);
        p.setProperty("iter", Integer.toString(iter));
        put("enveloppe", outer);
        p.setProperty("v", "1");
    }

    /** Premier lancement (ou restauration) : nouvelle DEK, protégée par le code. */
    synchronized byte[] create(char[] pin) throws GeneralSecurityException, IOException {
        if (exists()) throw new GeneralSecurityException("Coffre déjà créé");
        deleteKey(KEY_DEVICE);
        deleteKey(KEY_BIO);
        p = new Properties();
        byte[] dek = new byte[Coffre.DEK_BYTES];
        rnd.nextBytes(dek);
        wrapWithPin(dek, pin);
        p.setProperty("echecs", "0");
        store();
        return dek;
    }

    /**
     * Essai de code. Le compteur est augmenté AVANT l'essai (un arrêt forcé de l'appli ne l'efface pas),
     * puis remis à zéro si le code est bon.
     */
    synchronized Attempt unlock(char[] pin) throws IOException {
        if (!exists()) return new Attempt(null, "casse", 0, 0);
        long now = System.currentTimeMillis();
        int n = num("echecs");
        long last = time("dernier");
        if (now < last) {                     // horloge reculée : le délai repart de maintenant
            p.setProperty("dernier", Long.toString(now));
            store();
            last = now;
        }
        long wait = Coffre.waitMs(n, last, now);
        if (wait > 0) return new Attempt(null, "attente", wait, n);

        p.setProperty("echecs", Integer.toString(n + 1));
        p.setProperty("dernier", Long.toString(now));
        store();
        byte[] inner = null;
        try {
            SecretKey device = getKey(KEY_DEVICE);
            if (device == null) return new Attempt(null, "casse", 0, n + 1);
            inner = Coffre.open(device, bytes("enveloppe"), Coffre.AAD_DEVICE);
            byte[] dek = Coffre.unwrapPin(inner, pin, bytes("sel"), num("iter"));
            p.setProperty("echecs", "0");
            store();
            return new Attempt(dek, null, 0, 0);
        } catch (AEADBadTagException e) {
            if (inner == null) return new Attempt(null, "casse", 0, n + 1);
            return new Attempt(null, "code", Coffre.waitMs(n + 1, now, now), n + 1);
        } catch (GeneralSecurityException e) {
            return new Attempt(null, "casse", 0, n + 1);
        } finally {
            if (inner != null) Arrays.fill(inner, (byte) 0);
        }
    }

    /** Nouveau code (la DEK ne change pas). */
    synchronized void rewrap(byte[] dek, char[] pin) throws GeneralSecurityException, IOException {
        wrapWithPin(dek, pin);
        store();
    }

    /** Déverrouillage par empreinte réussi : le compteur de codes faux repart de zéro. */
    synchronized void resetFailures() throws IOException {
        p.setProperty("echecs", "0");
        store();
    }

    // ------------------------------------------------------------ empreinte

    /**
     * Chiffreur prêt pour l'activation (nouvelle clé empreinte).
     * Ni updateAAD ni doFinal avant BiometricPrompt : pour une clé exigeant l'empreinte à chaque usage,
     * Android refuse toute opération avant l'authentification (erreur mise de côté puis levée par doFinal).
     */
    synchronized Cipher bioEncrypter() throws GeneralSecurityException, IOException {
        deleteKey(KEY_BIO);
        newKey(KEY_BIO, true);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, getKey(KEY_BIO));
        return c;
    }

    synchronized void saveBio(byte[] ivAndCt) throws IOException {
        put("empreinte", ivAndCt);
        p.remove("empreinte.invalidee");
        store();
    }

    /**
     * Déchiffreur prêt pour le déverrouillage (updateAAD et doFinal après BiometricPrompt). null si l'empreinte a été invalidée (nouvelle empreinte enregistrée) :
     * l'enveloppe est alors supprimée et l'état « invalidee » est mémorisé.
     */
    synchronized Cipher bioDecrypter() throws GeneralSecurityException, IOException {
        byte[] env = bytes("empreinte");
        SecretKey k = getKey(KEY_BIO);
        if (env == null) return null;
        if (k == null) {
            invalidateBio();
            return null;
        }
        try {
            return Coffre.initOpen(k, env);
        } catch (KeyPermanentlyInvalidatedException e) {
            invalidateBio();
            return null;
        }
    }

    synchronized byte[] bioEnvelope() {
        return bytes("empreinte");
    }

    private void invalidateBio() throws IOException {
        deleteKey(KEY_BIO);
        p.remove("empreinte");
        p.setProperty("empreinte.invalidee", "1");
        store();
    }

    synchronized void disableBio() throws IOException {
        deleteKey(KEY_BIO);
        p.remove("empreinte");
        p.remove("empreinte.invalidee");
        store();
    }

    // ------------------------------------------------------------ blocs chiffrés (déjà chiffrés par l'appli)

    private AtomicFile blob(String name) {
        if (name == null || !name.matches("[a-z0-9_-]{1,32}")) throw new IllegalArgumentException("Nom de bloc invalide");
        return new AtomicFile(new File(blobs, name + ".bin"));
    }

    synchronized void writeBlob(String name, byte[] data) throws IOException {
        AtomicFile f = blob(name);
        if (!blobs.isDirectory() && !blobs.mkdirs()) throw new IOException("Dossier des blocs impossible à créer");
        FileOutputStream out = f.startWrite();
        try {
            out.write(data);
            f.finishWrite(out);
        } catch (IOException e) {
            f.failWrite(out);
            throw e;
        }
    }

    synchronized byte[] readBlob(String name) throws IOException {
        AtomicFile f = blob(name);
        if (!f.getBaseFile().exists()) return null;
        return f.readFully();
    }

    synchronized void deleteBlob(String name) {
        blob(name).delete();
    }

    // ------------------------------------------------------------ effacement complet (demandé par l'utilisateur)

    synchronized void wipe() {
        File[] fs = blobs.listFiles();
        if (fs != null) for (File f : fs) f.delete();
        blobs.delete();
        file.delete();
        deleteKey(KEY_DEVICE);
        deleteKey(KEY_BIO);
        deleteKey(KEY_RESUME);
        p = new Properties();
    }
}

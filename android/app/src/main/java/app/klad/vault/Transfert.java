package app.klad.vault;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Properties;

/**
 * Fichiers échangés avec le sélecteur Android, par morceaux (1.0.1), sans Android (testé par JUnit).
 *
 * Avant la 1.0.1, la sauvegarde entière passait en un seul message par le pont Capacitor, puis restait dans la
 * demande en attente pendant le sélecteur ; Capacitor la recopiait dans l'état sauvegardé de l'activité (limite
 * d'environ 1 Mo) quand Klad passait en arrière-plan : TransactionTooLargeException, Klad fermé sans trace.
 *
 * Désormais :
 * - écriture : l'appli ajoute des morceaux (déjà chiffrés) à un fichier temporaire privé ; le sélecteur ne reçoit
 *   qu'un jeton ; la copie vers le fichier choisi se fait en flux, puis le fichier est relu et comparé (taille et
 *   SHA-256). En cas d'échec, le fichier choisi est supprimé (ou vidé) : rien de partiel n'y reste.
 * - lecture : le fichier choisi est copié dans un fichier temporaire, que l'appli lit par morceaux.
 * - le résultat de chaque enregistrement est gardé sur disque : il survit au verrouillage, à la recréation de
 *   l'activité ou à l'arrêt de l'appli pendant le sélecteur, et l'appli le lit au déverrouillage suivant.
 */
public final class Transfert {

    /** Taille maximale d'un morceau passé par le pont (octets, avant base64). */
    public static final int MAX_MORCEAU = 512 * 1024;
    /** Taille maximale d'un fichier échangé. */
    public static final long MAX_FICHIER = 512L * 1024 * 1024;
    static final int BLOC = 64 * 1024;
    static final long AGE_MAX_MS = 24 * 3600_000L;
    private static final String RESULTAT = "resultat.properties";

    /** Fichier choisi par le sélecteur, vu comme un flux (ContentResolver sur le téléphone, mémoire en test). */
    public interface Destination {
        OutputStream ouvrir() throws IOException;          // écriture depuis le début, contenu précédent tronqué
        InputStream relire() throws IOException;
        boolean supprimer();                                 // true si le fichier choisi a été supprimé
    }

    /** Résultat d'un enregistrement ou d'une lecture. */
    public static final class Resultat {
        public final boolean ok;
        public final String raison;      // null, "annule", "erreur"
        public final String message;     // type d'erreur seulement (aucun contenu)
        public final long taille;

        Resultat(boolean ok, String raison, String message, long taille) {
            this.ok = ok;
            this.raison = raison;
            this.message = message;
            this.taille = taille;
        }

        static Resultat reussi(long taille) { return new Resultat(true, null, null, taille); }
        static Resultat echec(String raison, String message) { return new Resultat(false, raison, message, 0); }
    }

    private final File dossier;
    private final SecureRandom rnd = new SecureRandom();

    public Transfert(File dossier) {
        this.dossier = dossier;
    }

    // ------------------------------------------------------------ fichiers temporaires

    static boolean jetonValide(String j) {
        return j != null && j.matches("[0-9a-f]{16}");
    }

    File fichier(String jeton) {
        if (!jetonValide(jeton)) throw new IllegalArgumentException("Jeton invalide");
        return new File(dossier, jeton + ".tmp");
    }

    private void dossierPret() throws IOException {
        if (!dossier.isDirectory() && !dossier.mkdirs()) throw new IOException("Dossier temporaire impossible à créer");
    }

    /** Nouveau fichier temporaire vide → jeton. */
    public synchronized String ouvrir() throws IOException {
        dossierPret();
        byte[] b = new byte[8];
        rnd.nextBytes(b);
        StringBuilder s = new StringBuilder();
        for (byte x : b) s.append(String.format("%02x", x & 0xff));
        String j = s.toString();
        try (FileOutputStream out = new FileOutputStream(fichier(j))) {
            out.getFD().sync();
        }
        return j;
    }

    /** Ajoute un morceau → taille totale. */
    public synchronized long ajouter(String jeton, byte[] morceau) throws IOException {
        if (morceau.length > MAX_MORCEAU) throw new IOException("Morceau trop gros");
        File f = fichier(jeton);
        if (!f.isFile()) throw new IOException("Fichier temporaire absent");
        if (f.length() + morceau.length > MAX_FICHIER) throw new IOException("Fichier trop gros");
        try (FileOutputStream out = new FileOutputStream(f, true)) {
            out.write(morceau);
        }
        return f.length();
    }

    public synchronized long taille(String jeton) throws IOException {
        File f = fichier(jeton);
        if (!f.isFile()) throw new IOException("Fichier temporaire absent");
        return f.length();
    }

    /** Lit au plus longueur octets à partir de debut (tableau vide à la fin du fichier). */
    public synchronized byte[] lire(String jeton, long debut, int longueur) throws IOException {
        if (longueur < 0 || longueur > MAX_MORCEAU || debut < 0) throw new IOException("Lecture hors limites");
        File f = fichier(jeton);
        if (!f.isFile()) throw new IOException("Fichier temporaire absent");
        try (RandomAccessFile r = new RandomAccessFile(f, "r")) {
            long reste = Math.max(0, r.length() - debut);
            byte[] b = new byte[(int) Math.min(reste, longueur)];
            r.seek(debut);
            r.readFully(b);
            return b;
        }
    }

    public synchronized void abandonner(String jeton) {
        if (!jetonValide(jeton)) return;
        File f = fichier(jeton);
        if (f.exists() && !f.delete()) f.deleteOnExit();
    }

    /** Fichiers temporaires oubliés (appli arrêtée en cours de route) : supprimés après 24 h. */
    public synchronized int nettoyer(long maintenant) {
        File[] fs = dossier.listFiles((d, n) -> n.endsWith(".tmp"));
        int n = 0;
        if (fs != null) for (File f : fs) if (maintenant - f.lastModified() > AGE_MAX_MS && f.delete()) n++;
        return n;
    }

    // ------------------------------------------------------------ copies

    /** Copie le fichier temporaire vers la destination, relit et compare ; supprime la destination en cas d'échec. */
    public Resultat enregistrer(String jeton, Destination d) {
        File f;
        try {
            f = fichier(jeton);
            if (!f.isFile()) return Resultat.echec("erreur", "Fichier préparé introuvable (appli redémarrée ?)");
        } catch (IllegalArgumentException e) {
            return Resultat.echec("erreur", "Jeton invalide");
        }
        long taille = f.length();
        try {
            byte[] attendu;
            try (InputStream in = new FileInputStream(f); OutputStream out = d.ouvrir()) {
                if (out == null) throw new IOException("Fichier inaccessible");
                attendu = copier(in, out);
                out.flush();
            }
            long[] lu = new long[1];
            byte[] relu;
            try (InputStream in = d.relire()) {
                if (in == null) throw new IOException("Relecture impossible");
                relu = empreinte(in, lu);
            }
            if (lu[0] != taille || !MessageDigest.isEqual(attendu, relu))
                throw new IOException("Fichier enregistré différent (" + lu[0] + " octets sur " + taille + ")");
            abandonner(jeton);
            return Resultat.reussi(taille);
        } catch (Exception e) {
            effacer(d);
            abandonner(jeton);
            return Resultat.echec("erreur", KladVaultPlugin.describe(e));
        }
    }

    /** Rien de partiel : fichier choisi supprimé, ou à défaut vidé. */
    static void effacer(Destination d) {
        try {
            if (d.supprimer()) return;
        } catch (RuntimeException ignored) {
            // fournisseur sans suppression : on vide
        }
        try (OutputStream out = d.ouvrir()) {
            if (out != null) out.flush();
        } catch (Exception ignored) {
            // rien de plus possible
        }
    }

    /** Copie le fichier choisi dans un nouveau fichier temporaire → jeton ; null et rien de gardé en cas d'échec. */
    public String recevoir(InputStream in) throws IOException {
        String j = ouvrir();
        File f = fichier(j);
        try (OutputStream out = new FileOutputStream(f)) {
            byte[] b = new byte[BLOC];
            long n = 0;
            int k;
            while ((k = in.read(b)) > 0) {
                n += k;
                if (n > MAX_FICHIER) throw new IOException("Fichier trop gros");
                out.write(b, 0, k);
            }
        } catch (IOException e) {
            abandonner(j);
            throw e;
        }
        return j;
    }

    /** Copie par blocs → SHA-256 de ce qui a été copié. */
    static byte[] copier(InputStream in, OutputStream out) throws IOException {
        MessageDigest md = sha();
        byte[] b = new byte[BLOC];
        int k;
        while ((k = in.read(b)) > 0) {
            out.write(b, 0, k);
            md.update(b, 0, k);
        }
        return md.digest();
    }

    static byte[] empreinte(InputStream in, long[] taille) throws IOException {
        MessageDigest md = sha();
        byte[] b = new byte[BLOC];
        int k;
        long n = 0;
        while ((k = in.read(b)) > 0) {
            md.update(b, 0, k);
            n += k;
        }
        taille[0] = n;
        return md.digest();
    }

    private static MessageDigest sha() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------ résultat gardé sur disque

    /** Garde le résultat d'un enregistrement (lu par l'appli au déverrouillage si elle n'a pas pu le recevoir). */
    public synchronized void noter(String jeton, String nature, Resultat r, long le) {
        Properties p = new Properties();
        p.setProperty("jeton", jeton == null ? "" : jeton);
        p.setProperty("nature", nature == null ? "" : nature);
        p.setProperty("ok", r.ok ? "1" : "0");
        if (r.raison != null) p.setProperty("raison", r.raison);
        if (r.message != null) p.setProperty("message", r.message);
        p.setProperty("taille", Long.toString(r.taille));
        p.setProperty("le", Long.toString(le));
        try {
            dossierPret();
            File tmp = new File(dossier, RESULTAT + ".part");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                p.store(out, null);
                out.getFD().sync();
            }
            if (!tmp.renameTo(new File(dossier, RESULTAT))) throw new IOException("Résultat non gardé");
        } catch (IOException ignored) {
            // l'appli reçoit quand même la réponse si elle est encore là
        }
    }

    /** Dernier résultat gardé, ou null. */
    public synchronized Properties dernier() {
        File f = new File(dossier, RESULTAT);
        if (!f.isFile()) return null;
        Properties p = new Properties();
        try (FileInputStream in = new FileInputStream(f)) {
            p.load(in);
            return p;
        } catch (IOException e) {
            return null;
        }
    }

    /** Résultat pris en compte par l'appli : oublié (seulement s'il s'agit bien de ce jeton). */
    public synchronized void oublier(String jeton) {
        Properties p = dernier();
        if (p == null) return;
        if (jeton == null || jeton.equals(p.getProperty("jeton"))) new File(dossier, RESULTAT).delete();
    }
}

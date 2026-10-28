package app.klad.vault;

import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Logique pure du coffre, sans Android (testée par JUnit) :
 * enveloppes AES-GCM, dérivation du code (PBKDF2), calibrage, délais après des codes faux.
 */
public final class Coffre {

    public static final int DEK_BYTES = 32;
    public static final int SALT_BYTES = 16;
    static final int IV_BYTES = 12;
    static final int TAG_BITS = 128;

    // Itérations PBKDF2 : calibrées pour ≈ 0,5 s sur le téléphone, dans ces bornes.
    static final long TARGET_MS = 500;
    static final int ITER_MIN = 100_000;
    static final int ITER_MAX = 5_000_000;
    public static final int ITER_PROBE = 20_000;

    // Données associées : une enveloppe ne peut pas être prise pour une autre.
    public static final byte[] AAD_PIN = ascii("klad.code.v1");
    public static final byte[] AAD_DEVICE = ascii("klad.appareil.v1");
    public static final byte[] AAD_BIO = ascii("klad.empreinte.v1");

    private Coffre() {}

    static byte[] ascii(String s) {
        byte[] b = new byte[s.length()];
        for (int i = 0; i < b.length; i++) b[i] = (byte) s.charAt(i);
        return b;
    }

    /** Code à 6 chiffres exactement. */
    public static boolean isPin(String s) {
        return s != null && s.matches("[0-9]{6}");
    }

    /** PBKDF2-HMAC-SHA256 → 32 octets. */
    public static byte[] derive(char[] pin, byte[] salt, int iter) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(pin, salt, iter, 256);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }

    /**
     * Chiffre en AES-GCM ; résultat = IV (12 octets) | texte chiffré | étiquette (16 octets).
     * rnd != null : IV tiré ici (clé logicielle). rnd == null : IV choisi par le fournisseur (clé Keystore).
     */
    public static byte[] seal(Key key, byte[] plain, byte[] aad, SecureRandom rnd) throws GeneralSecurityException {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        if (rnd != null) {
            byte[] iv = new byte[IV_BYTES];
            rnd.nextBytes(iv);
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
        } else {
            c.init(Cipher.ENCRYPT_MODE, key);
        }
        c.updateAAD(aad);
        return join(c.getIV(), c.doFinal(plain));
    }

    /** Déchiffre IV | texte chiffré. Lève AEADBadTagException si la clé est mauvaise ou le bloc altéré. */
    public static byte[] open(Key key, byte[] blob, byte[] aad) throws GeneralSecurityException {
        Cipher c = initOpen(key, blob);
        c.updateAAD(aad);
        return c.doFinal(blob, IV_BYTES, blob.length - IV_BYTES);
    }

    /** Prépare le déchiffrement (utilisé tel quel pour l'empreinte : doFinal après BiometricPrompt). */
    public static Cipher initOpen(Key key, byte[] blob) throws GeneralSecurityException {
        if (blob == null || blob.length < IV_BYTES + TAG_BITS / 8) throw new GeneralSecurityException("Enveloppe trop courte");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, Arrays.copyOfRange(blob, 0, IV_BYTES)));
        return c;
    }

    /** Enveloppe intérieure « code » : DEK chiffrée par la clé tirée du code. */
    public static byte[] wrapPin(byte[] dek, char[] pin, byte[] salt, int iter, SecureRandom rnd) throws GeneralSecurityException {
        byte[] k = derive(pin, salt, iter);
        try {
            return seal(new SecretKeySpec(k, "AES"), dek, AAD_PIN, rnd);
        } finally {
            Arrays.fill(k, (byte) 0);
        }
    }

    /** Ouvre l'enveloppe intérieure. AEADBadTagException = code faux. */
    public static byte[] unwrapPin(byte[] env, char[] pin, byte[] salt, int iter) throws GeneralSecurityException {
        byte[] k = derive(pin, salt, iter);
        try {
            return open(new SecretKeySpec(k, "AES"), env, AAD_PIN);
        } finally {
            Arrays.fill(k, (byte) 0);
        }
    }

    /** Nombre d'itérations pour ≈ 0,5 s, d'après la durée mesurée de ITER_PROBE itérations. */
    public static int calibrate(long probeNanos) {
        long nanos = Math.max(1, probeNanos);
        long it = ITER_PROBE * TARGET_MS * 1_000_000L / nanos;
        it = Math.max(ITER_MIN, Math.min(ITER_MAX, it));
        return (int) (it / 1000 * 1000);
    }

    /** Délai imposé après n codes faux : rien jusqu'à 4, puis 30 s, 1 min, 5 min, 15 min, 30 min, 1 h au plus. */
    public static long delayMs(int failures) {
        if (failures < 5) return 0;
        switch (failures) {
            case 5: return 30_000L;
            case 6: return 60_000L;
            case 7: return 5 * 60_000L;
            case 8: return 15 * 60_000L;
            case 9: return 30 * 60_000L;
            default: return 60 * 60_000L;
        }
    }

    /**
     * Attente restante avant le prochain essai, depuis le dernier essai (last) à l'instant now.
     * Si l'horloge a reculé (now < last), le délai complet s'applique : l'appelant remet last à now.
     */
    public static long waitMs(int failures, long last, long now) {
        long d = delayMs(failures);
        if (d == 0) return 0;
        if (now < last) return d;
        return Math.max(0, last + d - now);
    }

    static byte[] join(byte[] a, byte[] b) {
        byte[] r = Arrays.copyOf(a, a.length + b.length);
        System.arraycopy(b, 0, r, a.length, b.length);
        return r;
    }
}

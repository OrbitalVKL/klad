package app.klad.update;

import java.security.MessageDigest;
import java.util.Locale;

/** Logique pure de la mise à jour (testée par JUnit) : adresse autorisée, empreinte SHA-256. */
public final class Maj {

    /** Taille maximale d'un APK téléchargé. */
    public static final long MAX_BYTES = 100L * 1024 * 1024;

    private Maj() {}

    /** Seules les publications GitHub en HTTPS sont acceptées : https://github.com/<compte>/<dépôt>/releases/download/… */
    public static boolean allowedUrl(String url) {
        return url != null && url.matches("https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/releases/download/[^\\s?#]+\\.apk");
    }

    public static String hex(byte[] b) {
        StringBuilder s = new StringBuilder(b.length * 2);
        for (byte x : b) s.append(String.format(Locale.ROOT, "%02x", x));
        return s.toString();
    }

    /** Empreinte attendue (« sha256:abc… » ou « abc… », 64 caractères hexadécimaux) → minuscules ; null si absente ou invalide. */
    public static String expectedSha256(String digest) {
        if (digest == null) return null;
        String d = digest.trim().toLowerCase(Locale.ROOT);
        if (d.startsWith("sha256:")) d = d.substring(7);
        return d.matches("[0-9a-f]{64}") ? d : null;
    }

    /** Comparaison en temps constant de l'empreinte calculée avec l'empreinte attendue. */
    public static boolean sameDigest(String expected, byte[] actual) {
        String e = expectedSha256(expected);
        return e != null && MessageDigest.isEqual(e.getBytes(), hex(actual).getBytes());
    }
}

package app.klad.grafit;

/**
 * Configuration du lien Grafit, en un seul endroit. Ce ne sont pas des secrets : le nom du paquet et l'empreinte
 * du certificat de signature figurent dans tout APK de Grafit.
 */
public final class GrafitConfig {

    /** Seule application autorisée à lire le résumé. */
    public static final String PACKAGE = "fr.orbitalvkl.grafit";

    /** Empreinte SHA-256 attendue du certificat de signature de Grafit (64 caractères hexadécimaux). */
    public static final String CERT_SHA256 = "D3FB8A672ADA21218B0A4EEA66ACD634B26C938A25CA1D2DD795665DBE5E82FC";

    /** Authority = identifiant d'appli + ce suffixe (déclaré dans le manifeste : ${applicationId}.grafit). */
    public static final String SUFFIXE = ".grafit";

    /** Chemin unique : content://<authority>/summary. */
    public static final String CHEMIN = "summary";

    private GrafitConfig() {}

    public static String authority(String applicationId) {
        return applicationId + SUFFIXE;
    }

    /** Empreinte en octets, pour PackageManager.hasSigningCertificate. */
    public static byte[] certificat() {
        return hex(CERT_SHA256);
    }

    static byte[] hex(String s) {
        if (s == null || s.length() % 2 != 0) throw new IllegalArgumentException("Empreinte invalide");
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) {
            int hi = Character.digit(s.charAt(2 * i), 16), lo = Character.digit(s.charAt(2 * i + 1), 16);
            if (hi < 0 || lo < 0) throw new IllegalArgumentException("Empreinte invalide");
            b[i] = (byte) ((hi << 4) | lo);
        }
        return b;
    }
}

package app.klad.grafit;

/**
 * Contrôle de l'appelant du GrafitProvider, sans Android (testé par JUnit).
 *
 * L'appelant est désigné par son UID (Binder.getCallingUid()), jamais par getCallingPackage() : le nom de paquet
 * annoncé par l'appelant n'est pas une preuve. Il est accepté seulement si :
 *   - les paquets de cet UID comprennent GrafitConfig.PACKAGE ;
 *   - ce paquet est signé par le certificat d'empreinte GrafitConfig.CERT_SHA256.
 * UID partagé : accepté s'il comprend Grafit correctement signé (Android impose la même signature à tous les
 * paquets d'un UID partagé).
 */
public final class Appelant {

    /** Ce que le contrôle demande au gestionnaire de paquets (PackageManager sur le téléphone, faux dans les tests). */
    public interface Paquets {
        /** Paquets de l'UID, ou null si l'UID est inconnu. */
        String[] pourUid(int uid);

        /** Le paquet est-il signé par ce certificat (empreinte SHA-256) ? */
        boolean signePar(String paquet, byte[] sha256);
    }

    private Appelant() {}

    /** true si l'UID est Grafit, signé par le bon certificat. */
    public static boolean autorise(int uid, Paquets pm) {
        if (pm == null) return false;
        String[] ps;
        try {
            ps = pm.pourUid(uid);
        } catch (RuntimeException e) {
            return false;
        }
        if (ps == null) return false;
        boolean present = false;
        for (String p : ps) if (GrafitConfig.PACKAGE.equals(p)) present = true;
        if (!present) return false;
        try {
            return pm.signePar(GrafitConfig.PACKAGE, GrafitConfig.certificat());
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Lève SecurityException si l'appelant n'est pas Grafit. */
    public static void verifier(int uid, Paquets pm) {
        if (!autorise(uid, pm)) throw new SecurityException("Lecture réservée à Grafit");
    }
}

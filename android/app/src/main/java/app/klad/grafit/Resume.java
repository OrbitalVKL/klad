package app.klad.grafit;

import app.klad.vault.Coffre;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * Résumé lu par Grafit, sans Android (testé par JUnit) : format du fichier chiffré, plafond de taille, ligne du curseur.
 *
 * Fichier : « KGR » | version (1 octet) | enveloppe AES-GCM de Coffre.seal (IV | texte chiffré | étiquette).
 * Texte clair : heure d'écriture (8 octets, ms) | JSON en UTF-8. Donnée associée : AAD.
 * Le JSON est produit par l'appli (www/resume.js) ; ici, il est seulement contrôlé, chiffré et relu.
 */
public final class Resume {

    public static final int V = 1;
    /** Taille maximale du JSON en octets UTF-8 (strictement inférieure à 32 Ko). */
    public static final int MAX_JSON = 32 * 1024 - 1;
    /** Réponse sans résumé enregistré (lien désactivé, rien d'écrit, ou fichier illisible). */
    public static final String VIDE = "{\"v\":1,\"state\":\"empty\"}";
    /** Colonnes du curseur, dans l'ordre. */
    public static final String[] COLONNES = {"v", "updated_at", "json"};

    static final byte[] MAGIC = {'K', 'G', 'R'};
    static final byte VERSION_FICHIER = 1;
    static final byte[] AAD = "klad.resume.v1".getBytes(StandardCharsets.US_ASCII);

    /** Résumé relu : heure d'écriture et JSON. */
    public static final class Lu {
        public final long misAJour;
        public final String json;

        public Lu(long misAJour, String json) {
            this.misAJour = misAJour;
            this.json = json;
        }
    }

    private Resume() {}

    /** Contrôle avant écriture : objet JSON (accolades) de moins de 32 Ko. IllegalArgumentException sinon. */
    public static byte[] valider(String json) {
        if (json == null) throw new IllegalArgumentException("Résumé absent");
        String t = json.trim();
        if (t.length() < 2 || t.charAt(0) != '{' || t.charAt(t.length() - 1) != '}') throw new IllegalArgumentException("Résumé : objet JSON attendu");
        byte[] b = json.getBytes(StandardCharsets.UTF_8);
        if (b.length > MAX_JSON) throw new IllegalArgumentException("Résumé trop gros (" + b.length + " octets)");
        return b;
    }

    /** Chiffre le résumé. rnd == null : IV choisi par le fournisseur (clé Keystore). */
    public static byte[] sceller(Key cle, long misAJour, String json, SecureRandom rnd) throws GeneralSecurityException {
        byte[] j = valider(json);
        byte[] clair = ByteBuffer.allocate(8 + j.length).putLong(misAJour).put(j).array();
        try {
            byte[] env = Coffre.seal(cle, clair, AAD, rnd);
            byte[] out = new byte[MAGIC.length + 1 + env.length];
            System.arraycopy(MAGIC, 0, out, 0, MAGIC.length);
            out[MAGIC.length] = VERSION_FICHIER;
            System.arraycopy(env, 0, out, MAGIC.length + 1, env.length);
            return out;
        } finally {
            Arrays.fill(clair, (byte) 0);
        }
    }

    /** Déchiffre un fichier de résumé. GeneralSecurityException si le format, la clé ou le contenu ne conviennent pas. */
    public static Lu ouvrir(Key cle, byte[] fichier) throws GeneralSecurityException {
        int h = MAGIC.length + 1;
        if (fichier == null || fichier.length < h || fichier[0] != MAGIC[0] || fichier[1] != MAGIC[1] || fichier[2] != MAGIC[2])
            throw new GeneralSecurityException("Résumé : format inconnu");
        if (fichier[MAGIC.length] != VERSION_FICHIER) throw new GeneralSecurityException("Résumé : version inconnue");
        byte[] clair = Coffre.open(cle, Arrays.copyOfRange(fichier, h, fichier.length), AAD);
        if (clair.length < 8) throw new GeneralSecurityException("Résumé tronqué");
        ByteBuffer b = ByteBuffer.wrap(clair);
        long t = b.getLong();
        return new Lu(t, new String(clair, 8, clair.length - 8, StandardCharsets.UTF_8));
    }

    /** Colonnes demandées (null : toutes). IllegalArgumentException pour une colonne inconnue. */
    public static String[] colonnes(String[] projection) {
        if (projection == null || projection.length == 0) return COLONNES.clone();
        for (String p : projection) if (!Arrays.asList(COLONNES).contains(p)) throw new IllegalArgumentException("Colonne inconnue : " + p);
        return projection.clone();
    }

    /** Ligne unique du curseur : v (int), updated_at (long, ms ; 0 sans résumé), json (String). */
    public static Object[] ligne(String[] colonnes, Lu lu) {
        Object[] r = new Object[colonnes.length];
        for (int i = 0; i < colonnes.length; i++) {
            switch (colonnes[i]) {
                case "v": r[i] = V; break;
                case "updated_at": r[i] = lu == null ? 0L : lu.misAJour; break;
                default: r[i] = lu == null ? VIDE : lu.json;
            }
        }
        return r;
    }
}

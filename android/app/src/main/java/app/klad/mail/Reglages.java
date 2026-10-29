package app.klad.mail;

import java.util.Locale;
import java.util.Properties;

/**
 * Réglages de connexion à une boîte aux lettres IMAP, contrôlés avant tout accès au réseau. Logique pure, testée par JUnit.
 * Seul le protocole « imaps » est utilisé : TLS dès le premier octet, nom du serveur vérifié sur son certificat.
 * IMAP en clair et STARTTLS sont refusés. Le message d'erreur ne cite jamais l'adresse ni le mot de passe.
 */
final class Reglages {

    static final String INVALIDES = "Réglages invalides";
    static final int PORT_DEFAUT = 993;
    /** Port d'IMAP en clair (ou STARTTLS) : refusé, Klad n'accepte que TLS dès le premier octet. */
    static final int PORT_CLAIR = 143;
    /** Délai de connexion, de lecture et d'écriture, en millisecondes. */
    static final int DELAI_MS = 20_000;

    final String hote;
    final int port;
    final String adresse;
    final String motDePasse;

    private Reglages(String hote, int port, String adresse, String motDePasse) {
        this.hote = hote;
        this.port = port;
        this.adresse = adresse;
        this.motDePasse = motDePasse;
    }

    /** Réglages contrôlés ; IllegalArgumentException(« Réglages invalides ») sinon. Port absent → 993. */
    static Reglages valider(String hote, Integer port, String adresse, String motDePasse) {
        String h = hote == null ? "" : hote.trim();
        if (!hoteValide(h)) throw new IllegalArgumentException(INVALIDES);
        int p = port == null ? PORT_DEFAUT : port;
        if (p < 1 || p > 65535 || p == PORT_CLAIR) throw new IllegalArgumentException(INVALIDES);
        String a = adresse == null ? "" : adresse.trim();
        if (a.isEmpty() || a.indexOf('@') < 1 || a.indexOf('@') == a.length() - 1 || contientEspace(a)) {
            throw new IllegalArgumentException(INVALIDES);
        }
        // Le mot de passe est gardé tel quel (un mot de passe d'application peut contenir des espaces).
        if (motDePasse == null || motDePasse.trim().isEmpty()) throw new IllegalArgumentException(INVALIDES);
        return new Reglages(h.toLowerCase(Locale.ROOT), p, a, motDePasse);
    }

    /** Nom de serveur seul : ni espace, ni schéma (« imaps:// »), ni chemin, ni port, ni identifiant. */
    static boolean hoteValide(String h) {
        if (h == null || h.isEmpty() || h.length() > 253) return false;
        if (contientEspace(h)) return false;
        return h.matches("[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?") && !h.contains("..");
    }

    private static boolean contientEspace(String s) {
        for (int i = 0; i < s.length(); i++) if (Character.isWhitespace(s.charAt(i))) return true;
        return false;
    }

    /** Propriétés de la session : imaps seulement, TLS obligatoire, certificat et nom vérifiés, délais de 20 s, lecture sans marquer « lu ». */
    Properties proprietes() {
        Properties p = new Properties();
        String d = String.valueOf(DELAI_MS);
        p.setProperty("mail.store.protocol", "imaps");
        p.setProperty("mail.imaps.host", hote);
        p.setProperty("mail.imaps.port", String.valueOf(port));
        p.setProperty("mail.imaps.ssl.enable", "true");
        p.setProperty("mail.imaps.ssl.checkserveridentity", "true");
        // Vérification du nom par le code d'Angus Mail (sans classe interne du JDK, absente d'Android).
        p.setProperty("mail.imaps.ssl.hostnameverifier.class", "MailHostnameVerifier");
        p.setProperty("mail.imaps.starttls.enable", "false");
        // Pas de SASL : javax.security.sasl n'existe pas sur Android ; connexion par LOGIN/PLAIN, à l'intérieur du TLS.
        p.setProperty("mail.imaps.sasl.enable", "false");
        p.setProperty("mail.imaps.socketFactory.fallback", "false");
        p.setProperty("mail.imaps.connectiontimeout", d);
        p.setProperty("mail.imaps.timeout", d);
        p.setProperty("mail.imaps.writetimeout", d);
        // BODY.PEEK : lire un message ne le marque pas comme lu (en plus de l'ouverture en lecture seule).
        p.setProperty("mail.imaps.peek", "true");
        // Pièces jointes lues par blocs de 256 Ko plutôt que 16 Ko.
        p.setProperty("mail.imaps.fetchsize", String.valueOf(256 * 1024));
        p.setProperty("mail.mime.decodefilename", "true");
        p.setProperty("mail.debug", "false");
        return p;
    }
}

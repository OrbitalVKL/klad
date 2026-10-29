package app.klad.mail;

import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.MessageRemovedException;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.ContentType;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.internet.MimePart;
import jakarta.mail.internet.MimeUtility;
import jakarta.mail.internet.ParseException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Conversion d'un courriel (jakarta.mail.Message) en objet simple : identifiant, date, expéditeur, sujet, texte, pièces PDF.
 * Lecture seule : aucun drapeau n'est posé, rien n'est déplacé ni supprimé. Sans dépendance Android ni réseau
 * (un message IMAP est lu à la demande par Angus Mail ; les tests utilisent des messages construits en mémoire).
 */
final class Lecture {

    /** Longueur maximale du texte renvoyé. */
    static final int TEXTE_MAX = 8000;
    /** Octets lus au plus par partie texte ou HTML (le texte est ensuite tronqué à TEXTE_MAX). */
    static final int TEXTE_OCTETS_MAX = 1024 * 1024;
    /** Taille maximale d'une pièce PDF renvoyée, et de l'ensemble des pièces d'un appel. */
    static final long PIECE_MAX = 3L * 1024 * 1024;
    static final long TOTAL_MAX = 15L * 1024 * 1024;
    /** Nombre maximal de courriels dont le contenu est lu pour chercher les mots-clés, par appel. */
    static final int EXAMEN_MAX = 300;
    private static final int PROFONDEUR_MAX = 10;

    private Lecture() {}

    /** Pièce PDF ; base64 null si elle dépasse les limites (elle reste listée, avec sa taille). */
    static final class Piece {
        final String nom;
        final String type;
        final long taille;
        final String base64;

        Piece(String nom, String type, long taille, String base64) {
            this.nom = nom;
            this.type = type;
            this.taille = taille;
            this.base64 = base64;
        }
    }

    static final class Courriel {
        final String id;
        final String date;
        final String expediteur;
        final String sujet;
        final String texte;
        final List<Piece> pieces;

        Courriel(String id, String date, String expediteur, String sujet, String texte, List<Piece> pieces) {
            this.id = id;
            this.date = date;
            this.expediteur = expediteur;
            this.sujet = sujet;
            this.texte = texte;
            this.pieces = Collections.unmodifiableList(pieces);
        }
    }

    /** Octets de pièces encore autorisés pour l'appel en cours (15 Mo au départ). */
    static final class Budget {
        long restant = TOTAL_MAX;
    }

    /** Identifiant de secours quand le courriel n'a pas d'en-tête Message-ID (UID du dossier). */
    interface Repli {
        String id(Message m) throws MessagingException;
    }

    /** Contenu parcouru : texte brut, HTML, parties PDF (pas encore lues). */
    static final class Contenu {
        final StringBuilder brut = new StringBuilder();
        final StringBuilder html = new StringBuilder();
        final List<Part> pdf = new ArrayList<>();

        /** Texte brut ; à défaut, HTML sans balises. Tronqué à TEXTE_MAX caractères. */
        String texte() {
            String t = brut.toString().trim();
            if (t.isEmpty()) t = sansBalises(html.toString());
            return tronquer(t, TEXTE_MAX);
        }
    }

    // ------------------------------------------------------------ choix des courriels

    /**
     * Courriels retenus parmi les candidats trouvés par le serveur, du plus récent au plus ancien : dans la période, d'un
     * expéditeur demandé, avec un mot-clé ; « max » au plus, EXAMEN_MAX lus au plus.
     */
    static List<Courriel> selectionner(List<Message> candidats, Criteres c, Date depuis, TimeZone tz, Repli repli)
            throws MessagingException, IOException {
        List<Message> l = new ArrayList<>(candidats);
        Collections.sort(l, (a, b) -> {
            Date da = dateDe(a), db = dateDe(b);
            if (da == null || db == null) return da == null ? (db == null ? 0 : 1) : -1;
            return db.compareTo(da);
        });
        List<Courriel> r = new ArrayList<>();
        Budget budget = new Budget();
        int examines = 0;
        for (Message m : l) {
            if (r.size() >= c.max || examines >= EXAMEN_MAX) break;
            try {
                if (!Criteres.dansPeriode(dateDe(m), depuis)) continue;
                if (!c.expediteurCorrespond(expediteur(m))) continue;
                examines++;
                Contenu ct = parcourir(m);
                if (!c.motsClesTrouves(sujet(m), ct.texte())) continue;
                r.add(lire(m, ct, repli, tz, budget));
            } catch (MessageRemovedException | ParseException e) {
                // Courriel supprimé entre-temps ou mal formé : ignoré.
            }
        }
        return r;
    }

    // ------------------------------------------------------------ conversion

    static Courriel lire(Message m, Contenu ct, Repli repli, TimeZone tz, Budget budget) throws MessagingException, IOException {
        List<Piece> pieces = new ArrayList<>();
        for (Part p : ct.pdf) pieces.add(piece(p, budget));
        return new Courriel(id(m, repli), date(dateDe(m), tz), expediteur(m), sujet(m), ct.texte(), pieces);
    }

    /** En-tête Message-ID ; à défaut, identifiant de secours. */
    static String id(Message m, Repli repli) throws MessagingException {
        String[] h = m.getHeader("Message-ID");
        if (h != null && h.length > 0 && h[0] != null && !h[0].trim().isEmpty()) return h[0].trim();
        String r = repli == null ? null : repli.id(m);
        return r == null ? "" : r;
    }

    /** Date de réception (serveur) ; à défaut, date d'envoi. */
    static Date dateDe(Message m) {
        try {
            Date d = m.getReceivedDate();
            return d != null ? d : m.getSentDate();
        } catch (MessagingException e) {
            return null;
        }
    }

    static String date(Date d, TimeZone tz) {
        if (d == null) return "";
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        f.setTimeZone(tz);
        return f.format(d);
    }

    /** Adresse du premier expéditeur ; « » si absente ou illisible. */
    static String expediteur(Message m) {
        try {
            Address[] de = m.getFrom();
            if (de == null || de.length == 0 || de[0] == null) return "";
            if (de[0] instanceof InternetAddress) {
                String a = ((InternetAddress) de[0]).getAddress();
                return a == null ? "" : a.trim();
            }
            return de[0].toString().trim();
        } catch (MessagingException e) {
            return "";
        }
    }

    static String sujet(Message m) {
        try {
            String s = m.getSubject();
            return s == null ? "" : s.trim();
        } catch (MessagingException e) {
            return "";
        }
    }

    // ------------------------------------------------------------ parcours des parties

    static Contenu parcourir(Part p) throws MessagingException, IOException {
        Contenu c = new Contenu();
        parcourir(p, c, 0);
        return c;
    }

    private static void parcourir(Part p, Contenu c, int profondeur) throws MessagingException, IOException {
        if (profondeur > PROFONDEUR_MAX) return;
        if (p.isMimeType("multipart/*")) {
            Multipart mp = multipart(p);
            for (int i = 0; i < mp.getCount(); i++) parcourir(mp.getBodyPart(i), c, profondeur + 1);
            return;
        }
        if (estPdf(p)) {
            c.pdf.add(p);
            return;
        }
        if (piecejointe(p)) return;
        if (p.isMimeType("message/rfc822")) {
            Object o = p.getContent();
            if (o instanceof Part) parcourir((Part) o, c, profondeur + 1);
            return;
        }
        if (p.isMimeType("text/plain")) {
            ajouter(c.brut, lireTexte(p));
        } else if (p.isMimeType("text/html")) {
            ajouter(c.html, lireTexte(p));
        }
    }

    private static void ajouter(StringBuilder b, String t) {
        if (t == null || t.trim().isEmpty() || b.length() > TEXTE_OCTETS_MAX) return;
        if (b.length() > 0) b.append("\n\n");
        b.append(t);
    }

    private static Multipart multipart(Part p) throws MessagingException, IOException {
        Object o = p.getContent();
        if (o instanceof Multipart) return (Multipart) o;
        return new MimeMultipart(p.getDataHandler().getDataSource());
    }

    /** Partie jointe : disposition « attachment » ou nom de fichier. */
    static boolean piecejointe(Part p) throws MessagingException {
        return Part.ATTACHMENT.equalsIgnoreCase(p.getDisposition()) || nomFichier(p) != null;
    }

    static boolean estPdf(Part p) throws MessagingException {
        if (p.isMimeType("multipart/*")) return false;
        if (p.isMimeType("application/pdf")) return true;
        String n = nomFichier(p);
        return n != null && n.toLowerCase(Locale.ROOT).endsWith(".pdf");
    }

    static String nomFichier(Part p) {
        try {
            String n = p.getFileName();
            if (n == null) return null;
            if (n.contains("=?")) {
                try {
                    n = MimeUtility.decodeText(n);
                } catch (IOException e) {
                    // nom laissé tel quel
                }
            }
            n = n.trim();
            return n.isEmpty() ? null : n;
        } catch (MessagingException e) {
            return null;
        }
    }

    /** Texte d'une partie, décodé selon son jeu de caractères (UTF-8 par défaut), TEXTE_OCTETS_MAX octets au plus. */
    static String lireTexte(Part p) throws MessagingException, IOException {
        byte[] b;
        try (InputStream in = p.getInputStream()) {
            b = lireAuPlus(in, TEXTE_OCTETS_MAX);
        }
        return new String(b, jeu(p)).replace("\r\n", "\n").replace('\r', '\n');
    }

    private static Charset jeu(Part p) {
        try {
            String cs = new ContentType(p.getContentType()).getParameter("charset");
            if (cs != null && !cs.trim().isEmpty()) return Charset.forName(MimeUtility.javaCharset(cs.trim()));
        } catch (Exception e) {
            // jeu inconnu ou en-tête mal formé : UTF-8
        }
        return StandardCharsets.UTF_8;
    }

    /** Octets du flux, coupés à « limite » (le reste n'est pas lu). */
    private static byte[] lireAuPlus(InputStream in, long limite) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        long lu = 0;
        int n;
        while ((n = in.read(buf)) > 0) {
            int garde = (int) Math.min(n, limite - lu);
            out.write(buf, 0, garde);
            lu += garde;
            if (lu >= limite) break;
        }
        return out.toByteArray();
    }

    // ------------------------------------------------------------ pièces PDF

    /** Taille décodée estimée d'après la taille transmise (base64 : × 3/4) ; -1 si inconnue. */
    static long tailleEstimee(Part p) throws MessagingException {
        int s = p.getSize();
        if (s < 0) return -1;
        String enc = p instanceof MimePart ? ((MimePart) p).getEncoding() : null;
        return "base64".equalsIgnoreCase(enc == null ? null : enc.trim()) ? s * 3L / 4 : s;
    }

    /**
     * Pièce PDF : contenu en base64 si elle fait 3 Mo au plus et tient dans le reste du budget de l'appel ; sinon listée
     * sans contenu. Une pièce dont la taille annoncée dépasse nettement la limite n'est pas téléchargée.
     */
    static Piece piece(Part p, Budget budget) throws MessagingException, IOException {
        String nom = nomFichier(p);
        if (nom == null) nom = "document.pdf";
        String type = "application/pdf";
        long estime = tailleEstimee(p);
        long limite = Math.min(PIECE_MAX, budget.restant);
        // Marge de 5 % : l'estimation compte les retours à la ligne du base64.
        if (limite <= 0 || estime > limite + limite / 20) return new Piece(nom, type, Math.max(estime, 0), null);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        long lu = 0;
        try (InputStream in = p.getInputStream()) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                lu += n;
                if (lu > limite) return new Piece(nom, type, Math.max(estime, lu), null);
                out.write(buf, 0, n);
            }
        }
        budget.restant -= lu;
        return new Piece(nom, type, lu, Base64.getEncoder().encodeToString(out.toByteArray()));
    }

    // ------------------------------------------------------------ texte

    private static final Pattern ENTITE = Pattern.compile("&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});");

    /** HTML → texte, de façon sommaire : scripts, styles et balises retirés, entités courantes décodées. */
    static String sansBalises(String html) {
        if (html == null || html.isEmpty()) return "";
        String s = html.replaceAll("(?is)<(script|style|head|title)\\b[^>]*>.*?</\\1\\s*>", " ");
        s = s.replaceAll("(?s)<!--.*?-->", " ");
        s = s.replaceAll("(?i)<br\\s*/?>", "\n");
        s = s.replaceAll("(?i)</(p|div|tr|li|h[1-6]|table|blockquote)\\s*>", "\n");
        s = s.replaceAll("(?s)<[^>]*>", " ");
        s = entites(s);
        s = s.replace(' ', ' ').replaceAll("[ \\t\\x0B\\f\\r]+", " ");
        s = s.replaceAll(" *\n *", "\n").replaceAll("\n{3,}", "\n\n");
        return s.trim();
    }

    private static String entites(String s) {
        Matcher m = ENTITE.matcher(s);
        StringBuffer r = new StringBuffer();
        while (m.find()) {
            String e = m.group(1);
            String v = null;
            if (e.startsWith("#")) {
                try {
                    int cp = e.length() > 1 && (e.charAt(1) == 'x' || e.charAt(1) == 'X')
                        ? Integer.parseInt(e.substring(2), 16) : Integer.parseInt(e.substring(1));
                    if (Character.isValidCodePoint(cp) && cp != 0) v = new String(Character.toChars(cp));
                } catch (NumberFormatException ignore) {
                    v = null;
                }
            } else {
                v = nommee(e);
            }
            m.appendReplacement(r, Matcher.quoteReplacement(v == null ? m.group() : v));
        }
        m.appendTail(r);
        return r.toString();
    }

    private static String nommee(String e) {
        switch (e) {
            case "nbsp": return " ";
            case "amp": return "&";
            case "lt": return "<";
            case "gt": return ">";
            case "quot": return "\"";
            case "apos": return "'";
            case "euro": return "€";
            case "eacute": return "é";
            case "egrave": return "è";
            case "ecirc": return "ê";
            case "agrave": return "à";
            case "acirc": return "â";
            case "ccedil": return "ç";
            case "ugrave": return "ù";
            case "ucirc": return "û";
            case "icirc": return "î";
            case "ocirc": return "ô";
            case "Eacute": return "É";
            case "laquo": return "«";
            case "raquo": return "»";
            case "rsquo": return "’";
            default: return null;
        }
    }

    /** Coupe à « max » caractères sans séparer une paire de substitution. */
    static String tronquer(String s, int max) {
        if (s == null) return "";
        if (s.length() <= max) return s;
        int fin = max;
        if (Character.isHighSurrogate(s.charAt(fin - 1))) fin--;
        return s.substring(0, fin);
    }
}

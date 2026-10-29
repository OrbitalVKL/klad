package app.klad.mail;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import jakarta.activation.DataHandler;
import jakarta.mail.Message;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.util.ByteArrayDataSource;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Properties;
import java.util.TimeZone;
import org.junit.Test;

/**
 * Tests JVM de la conversion des courriels : messages construits en mémoire (adresses fictives, faux PDF), aucun serveur.
 * Chaque message est écrit puis relu, comme un courriel reçu (parties encodées en base64, taille transmise).
 */
public class LectureTest {

    private static final Session SESSION = Session.getInstance(new Properties());
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");
    private static final long JOUR = 86_400_000L;
    /** 2026-10-29 15:00 UTC */
    private static final Date MAINTENANT = new Date(1_793_286_000_000L);

    private static byte[] fauxPdf(int taille, int graine) {
        byte[] b = new byte[taille];
        byte[] tete = "%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII);
        for (int i = 0; i < taille; i++) b[i] = (byte) (i * 31 + graine);
        System.arraycopy(tete, 0, b, 0, Math.min(tete.length, taille));
        return b;
    }

    private static MimeBodyPart texte(String t, String jeu) throws Exception {
        MimeBodyPart p = new MimeBodyPart();
        p.setText(t, jeu);
        return p;
    }

    private static MimeBodyPart pdf(String nom, byte[] contenu, String type) throws Exception {
        MimeBodyPart p = new MimeBodyPart();
        p.setDataHandler(new DataHandler(new ByteArrayDataSource(contenu, type)));
        p.setFileName(nom);
        p.setDisposition(Part.ATTACHMENT);
        return p;
    }

    private static MimeMessage message(String de, String sujet, Date date, MimeMultipart corps) throws Exception {
        MimeMessage m = new MimeMessage(SESSION);
        m.setFrom(new InternetAddress(de, "Expéditeur fictif", "UTF-8"));
        m.setRecipient(Message.RecipientType.TO, new InternetAddress("moi@exemple.test"));
        m.setSubject(sujet, "UTF-8");
        m.setSentDate(date);
        if (corps != null) m.setContent(corps);
        return m;
    }

    /** Écrit puis relit le message, comme reçu d'un serveur. */
    private static MimeMessage relu(MimeMessage m) throws Exception {
        m.saveChanges();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        m.writeTo(out);
        return new MimeMessage(SESSION, new ByteArrayInputStream(out.toByteArray()));
    }

    private static MimeMessage avecPdf(String de, String sujet, Date date, String t, byte[]... pdfs) throws Exception {
        MimeMultipart mp = new MimeMultipart("mixed");
        mp.addBodyPart(texte(t, "UTF-8"));
        for (int i = 0; i < pdfs.length; i++) mp.addBodyPart(pdf("piece" + (i + 1) + ".pdf", pdfs[i], "application/pdf"));
        return relu(message(de, sujet, date, mp));
    }

    private static Lecture.Courriel lire(Message m) throws Exception {
        return Lecture.lire(m, Lecture.parcourir(m), x -> "uid:7", UTC, new Lecture.Budget());
    }

    @Test
    public void texteEtPdf() throws Exception {
        byte[] contenu = fauxPdf(40_000, 1);
        MimeMessage m = avecPdf("Syndic@Exemple.test", "Appel de fonds — 4ᵉ trimestre", MAINTENANT, "Bonjour,\r\nVeuillez trouver l'appel de fonds.\r\n", contenu);
        Lecture.Courriel c = lire(m);
        assertTrue(c.id.startsWith("<") && c.id.endsWith(">"));
        assertEquals("2026-10-29", c.date);
        assertEquals("Syndic@Exemple.test", c.expediteur);
        assertEquals("Appel de fonds — 4ᵉ trimestre", c.sujet);
        assertEquals("Bonjour,\nVeuillez trouver l'appel de fonds.", c.texte);
        assertEquals(1, c.pieces.size());
        Lecture.Piece p = c.pieces.get(0);
        assertEquals("piece1.pdf", p.nom);
        assertEquals("application/pdf", p.type);
        assertEquals(40_000, p.taille);
        assertArrayEquals(contenu, Base64.getDecoder().decode(p.base64));
    }

    @Test
    public void seulementLesPdf() throws Exception {
        MimeMultipart mp = new MimeMultipart("mixed");
        mp.addBodyPart(texte("Texte du courriel", "UTF-8"));
        mp.addBodyPart(pdf("Échéancier 2027.PDF", fauxPdf(1000, 2), "application/octet-stream"));   // reconnu par son nom
        mp.addBodyPart(pdf("photo.jpg", fauxPdf(1000, 3), "image/jpeg"));                           // ignorée
        MimeBodyPart joint = texte("pièce texte, pas le corps", "UTF-8");
        joint.setFileName("notes.txt");
        mp.addBodyPart(joint);                                                                        // ignorée
        Lecture.Courriel c = lire(relu(message("a@exemple.test", "Sujet", MAINTENANT, mp)));
        assertEquals("Texte du courriel", c.texte);
        assertEquals(1, c.pieces.size());
        assertEquals("Échéancier 2027.PDF", c.pieces.get(0).nom);
        assertEquals(1000, c.pieces.get(0).taille);
    }

    @Test
    public void htmlSeul() throws Exception {
        MimeMessage m = message("a@exemple.test", "Avis", MAINTENANT, null);
        m.setContent("<html><head><title>T</title><style>p{color:red}</style></head><body><p>Montant&nbsp;d&ucirc; :"
            + " 12,50&#160;&euro;</p><script>alert(1)</script><div>Échéance&nbsp;<b>15/11</b></div><!-- caché --></body></html>",
            "text/html; charset=UTF-8");
        Lecture.Courriel c = lire(relu(m));
        assertEquals("Montant dû : 12,50 €\nÉchéance 15/11", c.texte);
        assertTrue(c.pieces.isEmpty());
    }

    @Test
    public void alternativePrefereLeTexte() throws Exception {
        MimeMultipart alt = new MimeMultipart("alternative");
        alt.addBodyPart(texte("Version texte", "UTF-8"));
        MimeBodyPart h = new MimeBodyPart();
        h.setContent("<p>Version HTML</p>", "text/html; charset=UTF-8");
        alt.addBodyPart(h);
        MimeBodyPart altPart = new MimeBodyPart();
        altPart.setContent(alt);
        MimeMultipart mixed = new MimeMultipart("mixed");
        mixed.addBodyPart(altPart);
        mixed.addBodyPart(pdf("avis.pdf", fauxPdf(500, 4), "application/pdf"));
        Lecture.Courriel c = lire(relu(message("a@exemple.test", "Sujet", MAINTENANT, mixed)));
        assertEquals("Version texte", c.texte);
        assertEquals(1, c.pieces.size());
    }

    @Test
    public void jeuDeCaracteresEtTroncature() throws Exception {
        MimeMultipart mp = new MimeMultipart("mixed");
        StringBuilder b = new StringBuilder("Échéance ");
        while (b.length() < 9000) b.append("abcdefghij");
        mp.addBodyPart(texte(b.toString(), "ISO-8859-1"));
        Lecture.Courriel c = lire(relu(message("a@exemple.test", "Sujet", MAINTENANT, mp)));
        assertEquals(8000, c.texte.length());
        assertTrue(c.texte.startsWith("Échéance abc"));
        String emoji = new String(Character.toChars(0x1F600));
        assertEquals("ab", Lecture.tronquer("ab" + emoji + "cd", 3));       // paire de substitution non coupée
        assertEquals("ab" + emoji, Lecture.tronquer("ab" + emoji + "cd", 4));
        assertEquals("abc", Lecture.tronquer("abc", 8000));
    }

    @Test
    public void pieceTropGrosse() throws Exception {
        byte[] gros = fauxPdf((int) Lecture.PIECE_MAX + 1, 5);
        byte[] petit = fauxPdf(2000, 6);
        Lecture.Courriel c = lire(avecPdf("a@exemple.test", "Relevé", MAINTENANT, "texte", gros, petit));
        assertEquals(2, c.pieces.size());
        Lecture.Piece p = c.pieces.get(0);
        assertNull(p.base64);                                        // listée sans contenu
        assertTrue(p.taille > Lecture.PIECE_MAX - 100_000);          // taille (estimée) proche de la vraie
        assertEquals(2000, c.pieces.get(1).taille);
        assertArrayEquals(petit, Base64.getDecoder().decode(c.pieces.get(1).base64));

        // Pile à la limite : gardée.
        byte[] limite = fauxPdf((int) Lecture.PIECE_MAX, 7);
        Lecture.Courriel d = lire(avecPdf("a@exemple.test", "Relevé", MAINTENANT, "texte", limite));
        assertArrayEquals(limite, Base64.getDecoder().decode(d.pieces.get(0).base64));
    }

    @Test
    public void budgetDeQuinzeMo() throws Exception {
        int t = 2_900_000;
        MimeMessage m = avecPdf("a@exemple.test", "Relevés", MAINTENANT, "texte",
            fauxPdf(t, 1), fauxPdf(t, 2), fauxPdf(t, 3), fauxPdf(t, 4), fauxPdf(t, 5), fauxPdf(t, 6));
        Lecture.Budget budget = new Lecture.Budget();
        Lecture.Courriel c = Lecture.lire(m, Lecture.parcourir(m), null, UTC, budget);
        assertEquals(6, c.pieces.size());
        for (int i = 0; i < 5; i++) assertEquals(t, Base64.getDecoder().decode(c.pieces.get(i).base64).length);
        assertNull(c.pieces.get(5).base64);
        assertTrue(c.pieces.get(5).taille > 0);
        assertEquals(Lecture.TOTAL_MAX - 5L * t, budget.restant);
    }

    @Test
    public void identifiantDeSecours() throws Exception {
        MimeMessage m = avecPdf("a@exemple.test", "Sujet", MAINTENANT, "texte");
        m.removeHeader("Message-ID");
        assertEquals("uid:7", lire(m).id);
        assertEquals("", Lecture.id(m, null));
        m.setHeader("Message-ID", " <abc@exemple.test> ");
        assertEquals("<abc@exemple.test>", Lecture.id(m, null));
    }

    @Test
    public void sansExpediteurNiSujet() throws Exception {
        MimeMessage m = new MimeMessage(SESSION);
        m.setText("Corps");
        m = relu(m);
        assertEquals("", Lecture.expediteur(m));
        assertEquals("", Lecture.sujet(m));
        assertEquals("", Lecture.date(null, UTC));
        assertEquals("Corps", lire(m).texte);
    }

    @Test
    public void selectionPlusRecentsDAbord() throws Exception {
        Criteres c = new Criteres(Arrays.asList("syndic@exemple.test", "energie.exemple"), Arrays.asList("échéance", "appel de fonds"), 30, 2);
        Date depuis = c.depuis(MAINTENANT, UTC);
        List<Message> l = new ArrayList<>();
        l.add(avecPdf("syndic@exemple.test", "Appel de fonds", new Date(MAINTENANT.getTime() - 20 * JOUR), "texte"));   // 3e plus récent
        l.add(avecPdf("factures@energie.exemple.test", "Votre facture", new Date(MAINTENANT.getTime() - 2 * JOUR), "Prochaine ECHEANCE le 5")); // 1er
        l.add(avecPdf("syndic@exemple.test", "Lettre d'information", new Date(MAINTENANT.getTime() - JOUR), "Rien"));    // sans mot-clé
        l.add(avecPdf("autre@exemple.test", "Échéance", new Date(MAINTENANT.getTime() - JOUR), "texte"));                  // autre expéditeur
        l.add(avecPdf("syndic@exemple.test", "Échéance", new Date(MAINTENANT.getTime() - 40 * JOUR), "texte"));           // trop ancien
        l.add(avecPdf("SYNDIC@exemple.test", "Échéancier", new Date(MAINTENANT.getTime() - 5 * JOUR), "Échéance du mois")); // 2e
        List<Lecture.Courriel> r = Lecture.selectionner(l, c, depuis, UTC, null);
        assertEquals(2, r.size());
        assertEquals("Votre facture", r.get(0).sujet);
        assertEquals("2026-10-27", r.get(0).date);
        assertEquals("Échéancier", r.get(1).sujet);

        Criteres tous = new Criteres(null, null, 30, null);
        List<Lecture.Courriel> t = Lecture.selectionner(l, tous, tous.depuis(MAINTENANT, UTC), UTC, null);
        assertEquals(5, t.size());
        assertFalse(t.stream().anyMatch(x -> x.date.equals("2026-09-19")));
        for (int i = 1; i < t.size(); i++) assertTrue(t.get(i - 1).date.compareTo(t.get(i).date) >= 0);
    }
}

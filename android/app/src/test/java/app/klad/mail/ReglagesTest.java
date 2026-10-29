package app.klad.mail;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.MessagingException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.Properties;
import javax.net.ssl.SSLHandshakeException;
import org.junit.Test;

/** Tests JVM des réglages de connexion et des messages d'erreur (adresses fictives, aucun réseau). */
public class ReglagesTest {

    private static final String MDP = "mot de passe fictif";

    private static void refuse(String hote, Integer port, String adresse, String mdp) {
        try {
            Reglages.valider(hote, port, adresse, mdp);
            fail("accepté : " + hote + " " + port);
        } catch (IllegalArgumentException e) {
            assertEquals("Réglages invalides", e.getMessage());
        }
    }

    @Test
    public void reglagesValides() {
        Reglages r = Reglages.valider(" Imap.Exemple.Test ", null, " syndic@exemple.test ", MDP);
        assertEquals("imap.exemple.test", r.hote);
        assertEquals(993, r.port);
        assertEquals("syndic@exemple.test", r.adresse);
        assertEquals(MDP, r.motDePasse);   // gardé tel quel, espaces compris
        assertEquals(1993, Reglages.valider("192.0.2.10", 1993, "a@exemple.test", "x").port);
    }

    @Test
    public void reglagesRefuses() {
        refuse("", 993, "a@exemple.test", MDP);
        refuse(null, 993, "a@exemple.test", MDP);
        refuse("imap exemple.test", 993, "a@exemple.test", MDP);
        refuse("imaps://imap.exemple.test", 993, "a@exemple.test", MDP);
        refuse("imap.exemple.test:993", 993, "a@exemple.test", MDP);
        refuse("imap.exemple.test/inbox", 993, "a@exemple.test", MDP);
        refuse("compte@imap.exemple.test", 993, "a@exemple.test", MDP);
        refuse("imap..exemple.test", 993, "a@exemple.test", MDP);
        refuse("imap.exemple.test", 0, "a@exemple.test", MDP);
        refuse("imap.exemple.test", 65536, "a@exemple.test", MDP);
        refuse("imap.exemple.test", 143, "a@exemple.test", MDP);   // IMAP en clair / STARTTLS
        refuse("imap.exemple.test", 993, "exemple.test", MDP);
        refuse("imap.exemple.test", 993, "@exemple.test", MDP);
        refuse("imap.exemple.test", 993, "a@", MDP);
        refuse("imap.exemple.test", 993, null, MDP);
        refuse("imap.exemple.test", 993, "a@exemple.test", "");
        refuse("imap.exemple.test", 993, "a@exemple.test", "   ");
        refuse("imap.exemple.test", 993, "a@exemple.test", null);
    }

    @Test
    public void proprietesTlsSeulement() {
        Properties p = Reglages.valider("imap.exemple.test", 993, "a@exemple.test", MDP).proprietes();
        assertEquals("imaps", p.getProperty("mail.store.protocol"));
        assertEquals("true", p.getProperty("mail.imaps.ssl.enable"));
        assertEquals("true", p.getProperty("mail.imaps.ssl.checkserveridentity"));
        assertEquals("false", p.getProperty("mail.imaps.starttls.enable"));
        assertEquals("true", p.getProperty("mail.imaps.peek"));
        assertEquals("false", p.getProperty("mail.imaps.sasl.enable"));
        assertEquals("20000", p.getProperty("mail.imaps.connectiontimeout"));
        assertEquals("20000", p.getProperty("mail.imaps.timeout"));
        assertEquals("993", p.getProperty("mail.imaps.port"));
        // Ni adresse ni mot de passe dans les propriétés de la session.
        assertFalse(p.toString().contains("a@exemple.test"));
        assertFalse(p.toString().contains(MDP));
        assertNull(p.getProperty("mail.imap.host"));
    }

    @Test
    public void erreursGeneriques() {
        assertEquals(Erreurs.IDENTIFIANTS, Erreurs.message(new AuthenticationFailedException("[AUTH] refus pour a@exemple.test")));
        assertEquals(Erreurs.DELAI, Erreurs.message(new MessagingException("lecture", new SocketTimeoutException("Read timed out"))));
        assertEquals(Erreurs.INJOIGNABLE, Erreurs.message(new MessagingException("connexion", new UnknownHostException("imap.exemple.test"))));
        assertEquals(Erreurs.INJOIGNABLE, Erreurs.message(new MessagingException("connexion", new ConnectException("refusée"))));
        assertEquals(Erreurs.CHIFFREMENT, Erreurs.message(new MessagingException("tls", new SSLHandshakeException("certificat"))));
        assertEquals(Erreurs.INVALIDES, Erreurs.message(new IllegalArgumentException(Reglages.INVALIDES)));
        assertEquals(Erreurs.AUTRE, Erreurs.message(new IllegalStateException("a@exemple.test " + MDP)));
        assertEquals(Erreurs.AUTRE, Erreurs.message(null));
        // Exception suivante d'une MessagingException
        MessagingException m = new MessagingException("dossier");
        m.setNextException(new SocketTimeoutException("x"));
        assertEquals(Erreurs.DELAI, Erreurs.message(m));
        for (String s : new String[] {Erreurs.IDENTIFIANTS, Erreurs.DELAI, Erreurs.INJOIGNABLE, Erreurs.CHIFFREMENT, Erreurs.AUTRE}) {
            assertFalse(s.contains("@"));
            assertTrue(s.length() > 5);
        }
    }
}

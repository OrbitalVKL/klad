package app.klad.mail;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.search.AndTerm;
import jakarta.mail.search.ComparisonTerm;
import jakarta.mail.search.FromStringTerm;
import jakarta.mail.search.OrTerm;
import jakarta.mail.search.ReceivedDateTerm;
import jakarta.mail.search.SearchTerm;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.Properties;
import java.util.TimeZone;
import org.junit.Test;

/** Tests JVM des critères de recherche : expéditeurs, mots-clés sans casse ni accents, période, limites. */
public class CriteresTest {

    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

    private static Criteres criteres(String[] exp, String[] mots, Integer jours, Integer max) {
        return new Criteres(exp == null ? null : Arrays.asList(exp), mots == null ? null : Arrays.asList(mots), jours, max);
    }

    @Test
    public void normalisation() {
        assertEquals("echeance electricite", Criteres.normaliser("  ÉCHÉANCE   Électricité "));
        assertEquals("oeuvre ca", Criteres.normaliser("Œuvre ÇA"));
        assertEquals("", Criteres.normaliser(null));
    }

    @Test
    public void expediteurs() {
        Criteres c = criteres(new String[] {"Syndic@Exemple.test", " ", "energie.exemple"}, null, 30, 10);
        assertEquals(Arrays.asList("syndic@exemple.test", "energie.exemple"), c.expediteurs);
        assertTrue(c.expediteurCorrespond("SYNDIC@exemple.TEST"));
        assertTrue(c.expediteurCorrespond("factures@energie.exemple.test"));
        assertFalse(c.expediteurCorrespond("autre@exemple.test"));
        assertFalse(c.expediteurCorrespond(""));
        assertTrue(criteres(new String[0], null, 30, 10).expediteurCorrespond("qui@exemple.test"));
    }

    @Test
    public void motsCles() {
        Criteres c = criteres(null, new String[] {"Échéancier", "appel de fonds"}, 30, 10);
        assertTrue(c.motsClesTrouves("Votre ECHEANCIER 2027", ""));
        assertTrue(c.motsClesTrouves("Avis", "Ci-joint l'Appel  de   Fonds du trimestre"));
        assertTrue(c.motsClesTrouves("echéancier", null));
        assertFalse(c.motsClesTrouves("Lettre d'information", "Rien à signaler"));
        assertTrue(criteres(null, new String[] {"", "  "}, 30, 10).motsClesTrouves("n'importe quoi", ""));
        assertTrue(criteres(null, null, 30, 10).motsClesTrouves(null, null));
    }

    @Test
    public void limites() {
        Criteres c = criteres(null, null, 5000, 1000);
        assertEquals(800, c.jours);
        assertEquals(100, c.max);
        c = criteres(null, null, null, null);
        assertEquals(Criteres.JOURS_DEFAUT, c.jours);
        assertEquals(50, c.max);
        c = criteres(null, null, -3, 0);
        assertEquals(0, c.jours);
        assertEquals(50, c.max);
        assertEquals(7, criteres(null, null, 10, 7).max);
    }

    @Test
    public void periode() {
        Criteres c = criteres(null, null, 10, 10);
        Date maintenant = new Date(1_793_286_000_000L);   // 2026-10-29 15:00 UTC
        Date depuis = c.depuis(maintenant, UTC);
        assertEquals("2026-10-19", Lecture.date(depuis, UTC));
        assertEquals(0, depuis.getTime() % 86_400_000L);                     // minuit
        assertTrue(Criteres.dansPeriode(depuis, depuis));
        assertTrue(Criteres.dansPeriode(maintenant, depuis));
        assertFalse(Criteres.dansPeriode(new Date(depuis.getTime() - 1), depuis));
        assertFalse(Criteres.dansPeriode(null, depuis));
    }

    @Test
    public void termeServeur() throws Exception {
        Date depuis = new Date(1_792_368_000_000L);
        SearchTerm seul = criteres(null, null, 10, 10).terme(depuis);
        assertTrue(seul instanceof ReceivedDateTerm);
        assertEquals(ComparisonTerm.GE, ((ReceivedDateTerm) seul).getComparison());

        SearchTerm un = criteres(new String[] {"syndic@exemple.test"}, null, 10, 10).terme(depuis);
        assertTrue(un instanceof AndTerm);
        assertTrue(((AndTerm) un).getTerms()[1] instanceof FromStringTerm);

        SearchTerm deux = criteres(new String[] {"syndic@exemple.test", "energie.exemple"}, null, 10, 10).terme(depuis);
        SearchTerm de = ((AndTerm) deux).getTerms()[1];
        assertTrue(de instanceof OrTerm);
        assertEquals(2, ((OrTerm) de).getTerms().length);

        // Le terme « expéditeur » appliqué à un message en mémoire (comme le ferait le serveur) : sans casse.
        MimeMessage m = new MimeMessage(Session.getInstance(new Properties()));
        m.setFrom(new InternetAddress("Factures@Energie.Exemple.test"));
        assertTrue(de.match(m));
        m.setFrom(new InternetAddress("autre@exemple.test"));
        assertFalse(de.match(m));
        assertEquals(Collections.emptyList(), criteres(null, null, 1, 1).expediteurs);
    }
}

package app.klad.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.Test;

public class WidgetDonneesTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");
    private static final long NOW = ZonedDateTime.parse("2026-11-09T19:04+01:00[Europe/Paris]").toInstant().toEpochMilli();
    private static final long H = 3600_000L;
    private static final String F = " ";

    private static WidgetDonnees.Affichage ok(Long rav, boolean epuise, int av, long sync, boolean reco) {
        return new WidgetDonnees(WidgetDonnees.Etat.OK, rav, epuise, av, sync, reco).affichage(NOW, PARIS);
    }

    @Test
    public void montants() {
        assertEquals("1" + F + "128", WidgetDonnees.montant(112849));
        assertEquals("42", WidgetDonnees.montant(4200));
        assertEquals("0", WidgetDonnees.montant(0));
        assertEquals("12" + F + "345" + F + "679", WidgetDonnees.montant(1234567890));
        assertEquals("sans signe", "42", WidgetDonnees.montant(-4200));
    }

    @Test
    public void aFaire() {
        WidgetDonnees.Affichage a = ok(112800L, false, 3, NOW - 5 * H, false);
        assertEquals("1" + F + "128", a.montant);
        assertTrue(a.chiffre);
        assertEquals(WidgetDonnees.Couleur.BLEU, a.couleur);
        assertEquals("3", a.pastille);
        assertEquals("14:04", a.bas);
        assertFalse(a.basAmbre);
        assertEquals(WidgetDonnees.Icone.SYNCHRO, a.icone);
        assertEquals("trier", a.vue);
    }

    @Test
    public void toutVuEtEpuise() {
        WidgetDonnees.Affichage a = ok(112800L, false, 0, NOW - H, false);
        assertNull(a.pastille);
        assertEquals("apercu", a.vue);
        WidgetDonnees.Affichage e = ok(-4200L, true, 1, NOW - H, false);
        assertEquals("42", e.montant);
        assertEquals(WidgetDonnees.Couleur.ROUGE, e.couleur);
        assertEquals("99+", ok(1L, false, 150, NOW, false).pastille);
    }

    @Test
    public void synchroAncienneEtBanque() {
        WidgetDonnees.Affichage a = ok(109400L, false, 5, NOW - 29 * H, false);   // hier 14:04
        assertEquals("hier 14:04", a.bas);
        assertTrue(a.basAmbre);
        assertEquals(WidgetDonnees.Icone.HORLOGE, a.icone);
        assertEquals("07/11", ok(1L, false, 0, NOW - 50 * H, false).bas);
        WidgetDonnees.Affichage r = ok(109400L, false, 0, NOW - H, true);
        assertEquals("à ouvrir", r.bas);
        assertTrue(r.basAmbre);
        assertEquals(WidgetDonnees.Icone.LIEN, r.icone);
        WidgetDonnees.Affichage j = ok(1L, false, 0, 0, false);
        assertEquals("—", j.bas);
        assertTrue(j.basAmbre);
    }

    @Test
    public void videDemoSansMontant() {
        WidgetDonnees.Affichage v = WidgetDonnees.vide().affichage(NOW, PARIS);
        assertEquals("—", v.montant);
        assertFalse(v.chiffre);
        assertEquals(WidgetDonnees.Couleur.GRIS, v.couleur);
        assertEquals("à ouvrir", v.bas);
        WidgetDonnees.Affichage d = new WidgetDonnees(WidgetDonnees.Etat.DEMO, 5000L, false, 4, NOW, false).affichage(NOW, PARIS);
        assertEquals("•••", d.montant);
        assertNull("rien de réel en mode démo", d.pastille);
        assertEquals(WidgetDonnees.Icone.CADENAS, d.icone);
        WidgetDonnees.Affichage n = ok(null, false, 2, NOW - H, false);
        assertEquals("—", n.montant);
        assertEquals(WidgetDonnees.Couleur.GRIS, n.couleur);
    }
}

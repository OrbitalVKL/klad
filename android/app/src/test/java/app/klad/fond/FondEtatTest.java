package app.klad.fond;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Test;

public class FondEtatTest {

    @After
    public void remettre() {
        FondEtat.remettre();
    }

    @Test
    public void appliOuverteBloqueLaSynchro() {
        FondEtat.appli(true);
        assertFalse(FondEtat.debut());
        FondEtat.appli(false);
        assertTrue(FondEtat.debut());
        assertFalse("une seule à la fois", FondEtat.debut());
        assertTrue(FondEtat.ecriturePermise());
        FondEtat.appli(true);                           // l'appli s'ouvre pendant la synchro
        assertFalse("plus aucune écriture", FondEtat.ecriturePermise());
        FondEtat.fin();
        assertFalse(FondEtat.enCours());
    }

    @Test
    public void attenteDeLaFin() throws Exception {
        assertFalse("rien en cours : pas d'attente", FondEtat.attendre(10));
        assertTrue(FondEtat.debut());
        new Thread(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) { }
            FondEtat.fin();
        }).start();
        long t = System.currentTimeMillis();
        assertTrue(FondEtat.attendre(5000));
        assertTrue(System.currentTimeMillis() - t < 4000);
        assertFalse(FondEtat.ecriturePermise());
    }

    @Test
    public void decisionSelonEtatDeKlad() {
        assertTrue("Klad verrouillé : on lance", FondEtat.decision() == FondEtat.Decision.LANCER);
        FondEtat.appli(true);
        FondEtat.premierPlan(true);
        assertTrue("Klad affiché : report", FondEtat.decision() == FondEtat.Decision.REPORTER);
        FondEtat.premierPlan(false);
        assertTrue("2.3.4 : déverrouillé mais quitté : on le verrouille", FondEtat.decision() == FondEtat.Decision.VERROUILLER);
        FondEtat.appli(false);
        assertTrue(FondEtat.debut());
        assertTrue(FondEtat.decision() == FondEtat.Decision.DEJA);
        FondEtat.fin();
    }

    @Test
    public void attenteDuVerrou() throws Exception {
        FondEtat.appli(true);
        assertFalse("pas de verrou : attente vaine", FondEtat.attendreVerrou(30));
        new Thread(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) { }
            FondEtat.appli(false);
        }).start();
        assertTrue(FondEtat.attendreVerrou(5000));
    }

    @Test
    public void quitteDepuisCinqMinutesSessionFermeeSansLaPage() {
        FondEtat.appli(true);
        FondEtat.premierPlan(false);                    // Klad quitté maintenant
        long now = System.currentTimeMillis();
        assertFalse("trop tôt", FondEtat.fermerSansPage(300_000, now + 60_000));
        assertTrue(FondEtat.fermerSansPage(300_000, now + 301_000));
        assertFalse(FondEtat.appliOuverte());
        assertTrue("écritures de la page refusées", FondEtat.fermeeParFond());
        FondEtat.appli(true);                           // déverrouillage
        assertFalse(FondEtat.fermeeParFond());
        FondEtat.premierPlan(true);                     // affiché : jamais fermé par la synchro
        assertFalse(FondEtat.fermerSansPage(300_000, now + 3_600_000));
    }
}

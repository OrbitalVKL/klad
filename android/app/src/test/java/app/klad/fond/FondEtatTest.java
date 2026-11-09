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
}

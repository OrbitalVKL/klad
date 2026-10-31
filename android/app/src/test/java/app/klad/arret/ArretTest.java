package app.klad.arret;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/** Journal des plantages (1.0.1) : ligne anonyme (type d'erreur, classe:ligne, action), gardée puis relue. */
public class ArretTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private static Throwable avecPile(Throwable e, String classe, int ligne) {
        e.setStackTrace(new StackTraceElement[] {
            new StackTraceElement("android.os.Parcel", "writeBundle", "Parcel.java", 900),
            new StackTraceElement(classe, "faire", "X.java", ligne),
        });
        return e;
    }

    @Test
    public void ligneAnonyme() {
        Throwable e = avecPile(new IllegalStateException("IBAN FR76 3000 · Banque Mirabelle · 1 234,56 €"), "app.klad.vault.KladVaultPlugin$1", 312);
        String l = Arret.ligne("export de la sauvegarde", e, 0L);
        assertTrue(l, l.startsWith("Klad s'est arrêté pendant export de la sauvegarde : IllegalStateException, KladVaultPlugin:312 (le "));
        assertFalse("aucun message d'erreur", l.contains("IBAN") || l.contains("Mirabelle") || l.contains("234"));
    }

    @Test
    public void causePremiereEtPileAndroid() {
        Throwable cause = avecPile(new RuntimeException("x"), "android.app.ActivityClient", 10);
        Throwable io = new java.io.IOException("z", cause);
        io.setStackTrace(new StackTraceElement[] { new StackTraceElement("android.os.BinderProxy", "transact", "B.java", 7) });
        Throwable e = new RuntimeException("y", io);
        e.setStackTrace(new StackTraceElement[] { new StackTraceElement("android.app.ActivityThread", "handleStop", "A.java", 5) });
        assertEquals("RuntimeException", Arret.type(new RuntimeException()));
        assertEquals("RuntimeException", Arret.type(e));
        Throwable oom = new RuntimeException("a", new OutOfMemoryError("b"));
        assertEquals("RuntimeException ← OutOfMemoryError", Arret.type(oom));
        assertEquals("ActivityThread:5", Arret.endroit(e));      // aucun code de Klad : première ligne connue
        assertEquals("?", Arret.endroit(new Error() { @Override public synchronized Throwable fillInStackTrace() { return this; } }));
    }

    @Test
    public void actionFiltree() {
        assertEquals("vérification d'une sauvegarde", Arret.filtrer("vérification d'une sauvegarde"));
        assertEquals("export", Arret.filtrer("export <compte> 1234@x.fr Mirabelle1"));
        assertTrue(Arret.ligne("", new Error(), 0L).contains("pendant l'utilisation"));
        assertTrue(Arret.ligneAffichage("synchronisation", false, 0L).contains("synchronisation : moteur d'affichage arrêté par Android (mémoire)"));
        Arret.action("export de la sauvegarde");
        assertEquals("export de la sauvegarde", Arret.action());
        Arret.action(null);
        assertEquals("", Arret.action());
    }

    @Test
    public void ligneGardeeRelueEffacee() throws Exception {
        File d = new File(tmp.getRoot(), "klad");
        assertNull(Arret.lire(d));
        Arret.noter(d, "première");
        Arret.noter(d, "Klad s'est arrêté pendant l'utilisation : Error, ?");
        assertEquals("Klad s'est arrêté pendant l'utilisation : Error, ?", Arret.lire(d));
        Arret.effacer(d);
        assertNull(Arret.lire(d));
    }

    @Test
    public void gestionnaireNotePuisLaissePlanter() throws Exception {
        File d = tmp.newFolder();
        AtomicReference<Throwable> vu = new AtomicReference<>();
        Thread.UncaughtExceptionHandler avant = (t, e) -> vu.set(e);
        Arret.Gestionnaire g = new Arret.Gestionnaire(d, avant);
        Arret.action("restauration");
        Throwable e = avecPile(new OutOfMemoryError("Failed to allocate 48 MB"), "app.klad.vault.Transfert", 77);
        g.uncaughtException(Thread.currentThread(), e);
        assertSame("comportement habituel ensuite", e, vu.get());
        String l = Arret.lire(d);
        assertTrue(l, l.startsWith("Klad s'est arrêté pendant restauration : OutOfMemoryError, Transfert:77"));
        Arret.action("");
    }
}

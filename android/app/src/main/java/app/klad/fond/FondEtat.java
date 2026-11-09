package app.klad.fond;

/**
 * État partagé dans le processus entre l'appli et la synchro planifiée (2.3.0), sans Android (testé par JUnit).
 *
 * - « appli ouverte » : l'appli est déverrouillée (données en mémoire). La synchro planifiée ne démarre pas, et
 *   n'écrit plus aucun bloc si l'appli s'ouvre pendant qu'elle tourne (les données de l'appli font foi).
 * - « en cours » : une synchro planifiée tourne. L'appli attend sa fin (90 s au plus) avant de lire les blocs.
 */
public final class FondEtat {

    private static boolean appliOuverte;
    private static boolean enCours;
    private static final Object VERROU = new Object();

    private FondEtat() {}

    /** Appli déverrouillée (true) ou verrouillée (false). */
    public static void appli(boolean ouverte) {
        synchronized (VERROU) {
            appliOuverte = ouverte;
            VERROU.notifyAll();
        }
    }

    public static boolean appliOuverte() {
        synchronized (VERROU) {
            return appliOuverte;
        }
    }

    /** Début d'une synchro planifiée : false si l'appli est ouverte ou qu'une autre tourne déjà. */
    public static boolean debut() {
        synchronized (VERROU) {
            if (appliOuverte || enCours) return false;
            enCours = true;
            return true;
        }
    }

    public static void fin() {
        synchronized (VERROU) {
            enCours = false;
            VERROU.notifyAll();
        }
    }

    public static boolean enCours() {
        synchronized (VERROU) {
            return enCours;
        }
    }

    /** Écriture d'un bloc permise à la synchro planifiée : seulement tant que l'appli n'est pas ouverte. */
    public static boolean ecriturePermise() {
        synchronized (VERROU) {
            return enCours && !appliOuverte;
        }
    }

    /** Attend la fin d'une synchro planifiée (maxMs au plus). true si elle tournait. */
    public static boolean attendre(long maxMs) throws InterruptedException {
        long fin = System.currentTimeMillis() + maxMs;
        synchronized (VERROU) {
            boolean tournait = enCours;
            while (enCours) {
                long reste = fin - System.currentTimeMillis();
                if (reste <= 0) break;
                VERROU.wait(reste);
            }
            return tournait;
        }
    }

    /** Tests seulement. */
    static void remettre() {
        synchronized (VERROU) {
            appliOuverte = false;
            enCours = false;
        }
    }
}

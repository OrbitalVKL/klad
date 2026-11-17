package app.klad.fond;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import app.klad.vault.CoffreFond;
import app.klad.vault.KladVaultPlugin;
import app.klad.widget.WidgetKlad;
import org.json.JSONObject;

/**
 * Un passage de la synchro planifiée (2.3.0), commun au service de premier plan (FondService, lancé par le réveil
 * depuis la 2.4.3) et au travail de secours (FondJob). Rien si elle est désactivée ou qu'un passage tourne déjà.
 * 2.3.4 : Klad déverrouillé mais quitté : verrouillage demandé (30 s au plus) puis passage ; Klad affiché à l'écran :
 * nouvel essai 30 min plus tard. Chaque passage est noté (Passages) pour Plus › Verrou. Le passage suivant est
 * programmé à la fin.
 */
final class Passage {

    static final long ATTENTE_VERROU_MS = 30_000;

    /** Appelé sur le fil principal quand un passage démarré (demarrer() a rendu true) est fini. */
    interface Fin {
        void fini();
    }

    /** Un passage tourne : ni réveil ni reprogrammation ne doivent l'arrêter. */
    private static volatile boolean tourne;

    static boolean tourne() {
        return tourne;
    }

    private final Context ctx;
    private final Fin fin;
    private final Handler h = new Handler(Looper.getMainLooper());
    private Execution ex;
    private boolean fini;

    Passage(Context ctx, Fin fin) {
        this.ctx = ctx;
        this.fin = fin;
    }

    private void finir() {
        tourne = false;
        if (fini) return;
        fini = true;
        fin.fini();
    }

    /** Fil principal. true : passage en cours (fin appelée plus tard) ; false : rien à faire ou empêché. */
    boolean demarrer() {
        Passages.debut(ctx);                      // 2.4.2 : trace du démarrage, avant tout le reste
        WidgetKlad.majTous(ctx);                  // heure de la dernière synchro : ambre au-delà de 12 h
        CoffreFond c = new CoffreFond(ctx);
        if (!c.existe() || !c.actif()) {
            Passages.noter(ctx, "inactif", "");
            h.post(() -> Planificateur.annuler(ctx));
            return false;
        }
        if (tourne) return false;
        switch (FondEtat.decision()) {
            case DEJA:
                return false;
            case REPORTER:
                reporter("reporte");
                return false;
            case VERROUILLER:
                // Klad déverrouillé en arrière-plan : verrouillage demandé, attente hors du fil principal
                if (!KladVaultPlugin.demanderVerrou()) {
                    reporter("verrou");
                    return false;
                }
                tourne = true;
                new Thread(() -> {
                    boolean ok;
                    try {
                        ok = FondEtat.attendreVerrou(ATTENTE_VERROU_MS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        ok = false;
                    }
                    final boolean verrouille = ok;
                    h.post(() -> {
                        if (verrouille && lancer()) return;
                        if (!verrouille) reporter("verrou");
                        finir();
                    });
                }, "klad-attente-verrou").start();
                return true;
            default:
                return lancer();
        }
    }

    private void reporter(String raison) {
        Passages.noter(ctx, raison, "");
        h.post(() -> Planificateur.dans(ctx, Planificateur.REPORT_MS));
    }

    /** Lance le passage (fil principal). false s'il n'a pas pu démarrer. */
    private boolean lancer() {
        if (!FondEtat.debut()) {
            reporter("verrou");
            return false;
        }
        try {
            tourne = true;
            ex = new Execution(ctx, (resultat, etape) -> {
                FondEtat.fin();
                Passages.noter(ctx, code(resultat), etape);
                WidgetKlad.majTous(ctx);
                finir();
                h.post(() -> Planificateur.planifier(ctx));
            });
            ex.lancer();
            return true;
        } catch (Exception e) {
            tourne = false;
            FondEtat.fin();
            Passages.noter(ctx, "erreur", "lancement");
            h.post(() -> Planificateur.planifier(ctx));
            return false;
        }
    }

    /** Android arrête le passage (travail stoppé, service détruit, délai du service dépassé). */
    void arreter() {
        if (ex != null) ex.terminer("arret");
        tourne = false;
    }

    /** Code court du résultat : JSON de la page ({ raison, erreurs }) ou raison d'Android (delai, moteur, arret). */
    static String code(String resultat) {
        if (resultat == null) return "?";
        try {
            JSONObject o = new JSONObject(resultat);
            String r = o.optString("raison", "?");
            if ("ok".equals(r) && o.optInt("erreurs", 0) > 0) return "erreurs";
            return r;
        } catch (Exception e) {
            return resultat.length() > 20 ? resultat.substring(0, 20) : resultat;
        }
    }
}

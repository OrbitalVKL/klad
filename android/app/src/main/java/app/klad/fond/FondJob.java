package app.klad.fond;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.os.Handler;
import android.os.Looper;
import app.klad.vault.CoffreFond;
import app.klad.vault.KladVaultPlugin;
import app.klad.widget.WidgetKlad;
import org.json.JSONObject;

/**
 * Synchro planifiée de 8 h et 14 h (2.3.0). Rien si elle est désactivée ou qu'un passage tourne déjà.
 * 2.3.4 : Klad déverrouillé mais quitté (il ne se verrouille qu'au retour) recevait la priorité et le passage de 8 h
 * était sauté jusqu'à 14 h : la synchro lui demande maintenant de se verrouiller (30 s au plus) puis passe ; Klad affiché
 * à l'écran : nouvel essai 30 min plus tard. Chaque passage est noté (Passages) pour Plus › Verrou.
 * Le passage suivant est programmé à la fin (programmer le même travail pendant qu'il tourne l'arrêterait).
 */
public class FondJob extends JobService {

    static final long ATTENTE_VERROU_MS = 30_000;

    private Execution ex;
    private final Handler h = new Handler(Looper.getMainLooper());

    @Override
    public boolean onStartJob(JobParameters params) {
        WidgetKlad.majTous(this);                 // heure de la dernière synchro : ambre au-delà de 12 h
        CoffreFond c = new CoffreFond(this);
        if (!c.existe() || !c.actif()) {
            Passages.noter(this, "inactif", "");
            h.post(() -> Planificateur.annuler(this));
            return false;
        }
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
                        if (verrouille && lancer(params)) return;
                        if (!verrouille) reporter("verrou");
                        jobFinished(params, false);
                    });
                }, "klad-attente-verrou").start();
                return true;
            default:
                return lancer(params);
        }
    }

    private void reporter(String raison) {
        Passages.noter(this, raison, "");
        h.post(() -> Planificateur.dans(this, Planificateur.REPORT_MS));
    }

    /** Lance le passage (fil principal). false s'il n'a pas pu démarrer. */
    private boolean lancer(JobParameters params) {
        if (!FondEtat.debut()) {
            reporter("verrou");
            return false;
        }
        try {
            ex = new Execution(this, (resultat, etape) -> {
                FondEtat.fin();
                Passages.noter(this, code(resultat), etape);
                WidgetKlad.majTous(this);
                jobFinished(params, false);
                h.post(() -> Planificateur.planifier(this));
            });
            ex.lancer();
            return true;
        } catch (Exception e) {
            FondEtat.fin();
            Passages.noter(this, "erreur", "lancement");
            h.post(() -> Planificateur.planifier(this));
            return false;
        }
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

    @Override
    public boolean onStopJob(JobParameters params) {
        if (ex != null) ex.terminer("arret");
        return false;
    }
}

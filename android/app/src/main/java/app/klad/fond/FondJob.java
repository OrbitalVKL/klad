package app.klad.fond;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.os.Handler;
import android.os.Looper;
import app.klad.vault.CoffreFond;
import app.klad.widget.WidgetKlad;

/**
 * Synchro planifiée de 8 h et 14 h (2.3.0). Rien si la synchro planifiée est désactivée, si Klad est ouvert
 * (déverrouillé) ou si une autre tourne. Le passage suivant est programmé à la fin (programmer le même travail
 * pendant qu'il tourne l'arrêterait).
 */
public class FondJob extends JobService {

    private Execution ex;
    private final Handler h = new Handler(Looper.getMainLooper());

    @Override
    public boolean onStartJob(JobParameters params) {
        WidgetKlad.majTous(this);                 // heure de la dernière synchro : ambre au-delà de 12 h
        CoffreFond c = new CoffreFond(this);
        if (!c.existe() || !c.actif()) {
            h.post(() -> Planificateur.annuler(this));
            return false;
        }
        if (!FondEtat.debut()) {
            h.post(() -> Planificateur.planifier(this));
            return false;
        }
        try {
            ex = new Execution(this, raison -> {
                FondEtat.fin();
                WidgetKlad.majTous(this);
                jobFinished(params, false);
                h.post(() -> Planificateur.planifier(this));
            });
            ex.lancer();
            return true;
        } catch (Exception e) {
            FondEtat.fin();
            h.post(() -> Planificateur.planifier(this));
            return false;
        }
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        if (ex != null) ex.terminer("arret");
        return false;
    }
}

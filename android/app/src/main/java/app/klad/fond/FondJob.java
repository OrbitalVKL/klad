package app.klad.fond;

import android.app.job.JobParameters;
import android.app.job.JobService;

/**
 * Travail JobScheduler de la synchro planifiée (2.3.0). Depuis la 2.4.3, seulement en secours : le réveil de 8 h et
 * 14 h lance FondService (sur certains téléphones, Android refuse les travaux de Klad). Le passage lui-même : Passage.
 */
public class FondJob extends JobService {

    private Passage p;

    public static boolean tourne() {
        return Passage.tourne();
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        p = new Passage(this, () -> jobFinished(params, false));
        return p.demarrer();
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        if (p != null) p.arreter();
        return false;
    }
}

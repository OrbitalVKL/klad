package app.klad.fond;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import java.time.ZoneId;

/**
 * Programmation de la synchro planifiée (2.3.0) par JobScheduler : un seul travail, reprogrammé après chaque passage
 * pour le passage suivant (8 h ou 14 h). Réseau exigé ; Android peut décaler le passage (économie d'énergie).
 * Conservé au redémarrage du téléphone.
 */
public final class Planificateur {

    static final int ID = 0x4b4c4401;   // « KLD » + 1

    private Planificateur() {}

    /** Programme le prochain passage (remplace le précédent). */
    public static void planifier(Context ctx) {
        JobScheduler js = ctx.getSystemService(JobScheduler.class);
        if (js == null) return;
        long now = System.currentTimeMillis();
        long delai = Math.max(0, Planning.prochain(now, ZoneId.systemDefault()) - now);
        JobInfo j = new JobInfo.Builder(ID, new ComponentName(ctx, FondJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setMinimumLatency(delai)
            .setPersisted(true)
            .build();
        js.schedule(j);
    }

    /** Programme le passage s'il ne l'est pas encore (ouverture de l'appli, redémarrage). */
    public static void verifier(Context ctx) {
        JobScheduler js = ctx.getSystemService(JobScheduler.class);
        if (js != null && js.getPendingJob(ID) == null) planifier(ctx);
    }

    public static void annuler(Context ctx) {
        JobScheduler js = ctx.getSystemService(JobScheduler.class);
        if (js != null) js.cancel(ID);
    }
}

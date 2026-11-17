package app.klad.fond;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.time.ZoneId;

/**
 * Programmation de la synchro planifiée (2.3.0) : 8 h et 14 h.
 *
 * 2.4.3 : le réveil lance un service de premier plan (FondService) ; le travail JobScheduler n'est plus qu'un secours
 * (refusé par Android sur certains téléphones, voir Passages.refus).
 *
 * 2.4.2 : un travail JobScheduler seul (délai minimal, sans échéance) pouvait être repoussé de plusieurs heures par
 * Android (veille, « appli peu utilisée »), et le passage n'avait pas lieu. Désormais :
 * - un réveil AlarmManager à l'heure prévue (exact quand Android le permet, sinon « autorisé en veille »), reçu par
 *   ReveilFond, qui lance tout de suite le travail (prioritaire, « expedited », depuis Android 12) ;
 * - le travail JobScheduler reste programmé en secours, SECOURS_MS après l'heure prévue (même identifiant : le
 *   réveil le remplace par le travail immédiat, jamais deux passages).
 * Réveil reposé au démarrage du téléphone et après une mise à jour (ReveilFond), et à chaque déverrouillage (verifier).
 */
public final class Planificateur {

    static final int ID = 0x4b4c4401;   // « KLD » + 1

    /** Report d'un passage empêché (Klad affiché, verrou non obtenu) : nouvel essai 30 min plus tard. */
    static final long REPORT_MS = 30 * 60_000L;

    /** Travail de secours : 30 min après l'heure prévue, si le réveil n'est pas arrivé. */
    static final long SECOURS_MS = 30 * 60_000L;

    private Planificateur() {}

    /** Programme le prochain passage, 8 h ou 14 h (remplace le précédent). */
    public static void planifier(Context ctx) {
        long now = System.currentTimeMillis();
        armer(ctx, Planning.prochain(now, ZoneId.systemDefault()));
    }

    /** 2.3.4 : passage dans delaiMs (report, ou essai demandé depuis Plus › Verrou), puis retour au rythme 8 h / 14 h. */
    public static void dans(Context ctx, long delaiMs) {
        armer(ctx, System.currentTimeMillis() + Math.max(0, delaiMs));
    }

    /** Réveil à l'heure « quand », travail de secours un peu après. */
    static void armer(Context ctx, long quand) {
        Passages.prochain(ctx, quand);
        reveil(ctx, quand);
        long latence = Math.max(0, quand + SECOURS_MS - System.currentTimeMillis());
        travail(ctx, latence, false);
    }

    /** 2.4.2 : passage tout de suite (réveil reçu). Prioritaire depuis Android 12, sinon travail ordinaire. */
    static void maintenant(Context ctx) {
        travail(ctx, 0, true);
    }

    private static void travail(Context ctx, long latence, boolean prioritaire) {
        JobScheduler js = ctx.getSystemService(JobScheduler.class);
        if (js == null) return;
        ComponentName cn = new ComponentName(ctx, FondJob.class);
        if (prioritaire && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                JobInfo j = new JobInfo.Builder(ID, cn)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setExpedited(true)
                    .build();
                if (js.schedule(j) == JobScheduler.RESULT_SUCCESS) return;
            } catch (RuntimeException e) {
                // quota de travaux prioritaires épuisé ou refus : travail ordinaire ci-dessous
                Passages.refus(ctx, "travail prioritaire", e);
            }
        }
        JobInfo j = new JobInfo.Builder(ID, cn)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setMinimumLatency(latence)
            .setPersisted(true)
            .build();
        // 2.4.3 : Android peut refuser (exception) : noté, jamais d'arrêt de Klad ; le réveil suffit au passage
        try {
            if (js.schedule(j) != JobScheduler.RESULT_SUCCESS) Passages.refus(ctx, "travail", new IllegalStateException("refusé"));
        } catch (RuntimeException e) {
            Passages.refus(ctx, "travail", e);
        }
    }

    private static PendingIntent intention(Context ctx, int drapeaux) {
        Intent i = new Intent(ctx, ReveilFond.class).setAction(ReveilFond.ACTION);
        return PendingIntent.getBroadcast(ctx, 0, i, drapeaux | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void reveil(Context ctx, long quand) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = intention(ctx, PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quand, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quand, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quand, pi);
        }
    }

    /**
     * Repose réveil et travail (déverrouillage, démarrage du téléphone, mise à jour de l'appli) : l'heure déjà
     * prévue si elle est à venir (report ou essai compris), sinon le prochain 8 h / 14 h. Rien pendant un passage
     * (reprogrammer le travail qui tourne l'arrêterait).
     */
    public static void verifier(Context ctx) {
        if (FondJob.tourne()) return;
        long now = System.currentTimeMillis();
        armer(ctx, Planning.reprendre(Passages.prochain(ctx), now, ZoneId.systemDefault()));
    }

    public static void annuler(Context ctx) {
        JobScheduler js = ctx.getSystemService(JobScheduler.class);
        if (js != null) js.cancel(ID);
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        PendingIntent pi = intention(ctx, PendingIntent.FLAG_NO_CREATE);
        if (am != null && pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
        Passages.prochain(ctx, 0);
    }
}

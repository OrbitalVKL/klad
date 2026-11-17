package app.klad.fond;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import app.klad.R;

/**
 * 2.4.3 : service de premier plan (type « synchronisation de données ») qui fait le passage de la synchro planifiée,
 * lancé par le réveil de 8 h / 14 h (ReveilFond). Sur le téléphone du propriétaire, Android refusait tout travail
 * JobScheduler de Klad (exception à la programmation) : le passage ne dépend plus de JobScheduler. Le réveil exact
 * autorise le démarrage d'un service de premier plan depuis l'arrière-plan.
 * Notification obligatoire pendant le passage (une minute environ), sans montant ni nom : canal discret ; sans
 * l'autorisation des notifications, Android ne l'affiche pas et le service tourne quand même.
 */
public class FondService extends Service {

    static final String CANAL = "klad.fond";
    static final int NOTIF = 0x4b4c44;
    static final long VERROU_ECRAN_MS = 6 * 60_000L;   // au-delà du délai de la page (4 min) et de l'attente du verrou

    private Passage p;
    private PowerManager.WakeLock eveil;

    /** Démarre le service. false si Android refuse (la raison est notée dans la trace). */
    static boolean lancer(Context ctx) {
        try {
            Intent i = new Intent(ctx, FondService.class);
            ctx.startForegroundService(i);
            return true;
        } catch (RuntimeException e) {
            Passages.refus(ctx, "service", e);
            return false;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            premierPlan();
        } catch (RuntimeException e) {
            Passages.refus(this, "premier plan", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (p != null) return START_NOT_STICKY;   // passage déjà en cours
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm != null) {
            eveil = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "klad:synchro");
            eveil.acquire(VERROU_ECRAN_MS);
        }
        p = new Passage(this, this::fin);
        if (!p.demarrer()) fin();
        return START_NOT_STICKY;
    }

    private void premierPlan() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            NotificationChannel c = new NotificationChannel(CANAL, "Synchro automatique", NotificationManager.IMPORTANCE_MIN);
            c.setShowBadge(false);
            nm.createNotificationChannel(c);
        }
        Notification n = new Notification.Builder(this, CANAL).setSmallIcon(R.drawable.ic_w_synchro)
            .setContentTitle("Klad synchronise…")
            .setOngoing(true)
            .setShowWhen(false)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF, n);
        }
    }

    private void fin() {
        p = null;
        relacher();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void relacher() {
        if (eveil != null && eveil.isHeld()) eveil.release();
        eveil = null;
    }

    /** Android 15 : délai des services « synchronisation de données » dépassé. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        if (p != null) p.arreter();
        fin();
    }

    @Override
    public void onDestroy() {
        if (p != null) p.arreter();
        p = null;
        relacher();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

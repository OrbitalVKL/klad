package app.klad.fond;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import app.klad.vault.CoffreFond;

/**
 * 2.4.2 : réveil de la synchro planifiée (AlarmManager, voir Planificateur) : lance le passage tout de suite. Reçoit
 * aussi le démarrage du téléphone et la mise à jour de l'appli, qui effacent les réveils : il les repose. Non exporté
 * (réveil par intention explicite ; démarrage et mise à jour envoyés par le système).
 */
public class ReveilFond extends BroadcastReceiver {

    static final String ACTION = "app.klad.fond.REVEIL";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        try {
            if (!new CoffreFond(ctx).actif()) return;
            if (ACTION.equals(a)) {
                Passages.reveil(ctx);
                if (!FondJob.tourne()) Planificateur.maintenant(ctx);
            } else if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
                Planificateur.verifier(ctx);
            }
        } catch (Exception ignored) {
            // travail de secours ou prochain déverrouillage
        }
    }
}

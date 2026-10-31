package app.klad.arret;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Plugin local « KladArret » (1.0.1) : journal des plantages (voir Arret).
 *   action({ nom }) : action en cours, reprise dans la ligne si Klad s'arrête (vide : aucune) ;
 *   lire() → { ligne } : ligne laissée par le dernier arrêt, ou null ; effacer() : ligne recopiée dans le journal.
 */
@CapacitorPlugin(name = "KladArret")
public class KladArretPlugin extends Plugin {

    public static File dossier(android.content.Context ctx) {
        return new File(ctx.getNoBackupFilesDir(), "klad");
    }

    @PluginMethod
    public void action(PluginCall call) {
        Arret.action(call.getString("nom", ""));
        call.resolve();
    }

    @PluginMethod
    public void lire(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ligne", Arret.lire(dossier(getContext())));
        call.resolve(r);
    }

    @PluginMethod
    public void effacer(PluginCall call) {
        Arret.effacer(dossier(getContext()));
        call.resolve();
    }
}

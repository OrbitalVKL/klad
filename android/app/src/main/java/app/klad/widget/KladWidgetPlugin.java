package app.klad.widget;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin local « KladWidget » (2.3.0) : données du widget d'écran d'accueil.
 *   ecrire({ json }) → contrôle (objet JSON de moins de 32 Ko), chiffrement, écriture atomique, widgets redessinés.
 *   effacer()        → données supprimées, widget « — ».
 *   style({ style }) → 2.3.1 : « bleu », « verre » ou « orbital » (Plus › Apparence), widgets redessinés.
 * Aucun contenu n'est journalisé.
 */
@CapacitorPlugin(name = "KladWidget")
public class KladWidgetPlugin extends Plugin {

    private static JSObject resultat(boolean ok, String raison) {
        JSObject r = new JSObject();
        r.put("ok", ok);
        if (raison != null) r.put("reason", raison);
        return r;
    }

    @PluginMethod
    public void ecrire(PluginCall call) {
        try {
            WidgetKlad.ecrire(getContext(), call.getString("json"));
            call.resolve(resultat(true, null));
        } catch (IllegalArgumentException | org.json.JSONException e) {
            call.resolve(resultat(false, "format"));
        } catch (Exception e) {
            call.resolve(resultat(false, "erreur"));
        }
    }

    @PluginMethod
    public void style(PluginCall call) {
        call.resolve(resultat(WidgetKlad.choisirStyle(getContext(), call.getString("style")), null));
    }

    @PluginMethod
    public void effacer(PluginCall call) {
        WidgetKlad.effacer(getContext());
        call.resolve(resultat(true, null));
    }
}

package app.klad.grafit;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Plugin local « KladGrafit » : enregistre le résumé lu par Grafit (GrafitProvider), puis prévient Grafit.
 *   ecrire({ json })  → contrôle (objet JSON, moins de 32 Ko), chiffrement, écriture atomique, notifyChange.
 *   effacer()         → suppression du fichier, notifyChange ; le provider renvoie alors {"v":1,"state":"empty"}.
 *   lire()            → { json } du résumé enregistré (null sans résumé), pour n'écrire que s'il a changé.
 *   infos()           → paquet et empreinte attendus de Grafit (affichés dans le réglage).
 * Aucun contenu du résumé n'est journalisé.
 */
@CapacitorPlugin(name = "KladGrafit")
public class KladGrafitPlugin extends Plugin {

    private Stockage stockage;

    @Override
    public void load() {
        stockage = GrafitProvider.stockage(getContext());
    }

    private void notifier() {
        getContext().getContentResolver().notifyChange(GrafitProvider.uri(getContext()), null);
    }

    private static JSObject resultat(boolean ok, String raison) {
        JSObject r = new JSObject();
        r.put("ok", ok);
        if (raison != null) r.put("reason", raison);
        return r;
    }

    @PluginMethod
    public void ecrire(PluginCall call) {
        String json = call.getString("json");
        try {
            Resume.valider(json);
            new JSONObject(json);
        } catch (Exception e) {
            call.resolve(resultat(false, "format"));
            return;
        }
        try {
            stockage.ecrire(json, System.currentTimeMillis());
            notifier();
            call.resolve(resultat(true, null));
        } catch (Exception e) {
            call.resolve(resultat(false, "erreur"));
        }
    }

    @PluginMethod
    public void effacer(PluginCall call) {
        JSObject r = resultat(true, null);
        r.put("existait", stockage.effacer());
        notifier();
        call.resolve(r);
    }

    @PluginMethod
    public void lire(PluginCall call) {
        Resume.Lu lu = stockage.lire();
        JSObject r = resultat(true, null);
        r.put("json", lu == null ? null : lu.json);
        r.put("updated_at", lu == null ? 0L : lu.misAJour);
        call.resolve(r);
    }

    @PluginMethod
    public void infos(PluginCall call) {
        JSObject r = resultat(true, null);
        r.put("package", GrafitConfig.PACKAGE);
        r.put("empreinte", GrafitConfig.CERT_SHA256);
        call.resolve(r);
    }
}

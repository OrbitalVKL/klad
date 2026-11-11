package app.klad.fond;

import android.content.Context;
import android.webkit.JavascriptInterface;
import app.klad.grafit.GrafitProvider;
import app.klad.grafit.Resume;
import app.klad.grafit.Stockage;
import app.klad.vault.CoffreFond;
import app.klad.widget.WidgetKlad;
import java.util.Arrays;
import java.util.Base64;
import org.json.JSONObject;

/**
 * Pont entre la page de fond (www/fond.js) et Android, pendant la synchro planifiée (2.3.0). Remplace les plugins de
 * l'appli par le strict nécessaire : coffre (état, DEK de l'enveloppe « arrière-plan », blocs chiffrés), résumé Grafit,
 * widget, réseau (Enable Banking seulement). Tout le reste répond { ok: false, reason: "fond" }.
 * Appels synchrones (fil du pont de la WebView) : la page attend chaque réponse. Rien n'est journalisé.
 */
final class Pont {

    private final Context ctx;
    private final Execution ex;
    private final CoffreFond coffre;

    Pont(Context ctx, Execution ex) {
        this.ctx = ctx.getApplicationContext();
        this.ex = ex;
        this.coffre = new CoffreFond(ctx);
    }

    @JavascriptInterface
    public String appel(String plugin, String methode, String options) {
        try {
            JSONObject o = options == null || options.isEmpty() ? new JSONObject() : new JSONObject(options);
            return new JSONObject().put("data", repondre(String.valueOf(plugin), String.valueOf(methode), o)).toString();
        } catch (Exception e) {
            try {
                return new JSONObject().put("erreur", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()).toString();
            } catch (Exception e2) {
                return "{\"erreur\":\"erreur\"}";
            }
        }
    }

    @JavascriptInterface
    public String http(String methode, String url, String entetes, String corps) {
        return Http.requete(methode, url, entetes, corps);
    }

    /** 2.3.4 : étape atteinte par la page (page, coffre, ouvert, synchro, enregistre), notée avec le résultat. */
    @JavascriptInterface
    public void etape(String e) {
        ex.etape(e);
    }

    @JavascriptInterface
    public void fin(String resultat) {
        ex.terminer(resultat == null ? "fin" : resultat);
    }

    private static JSONObject ok() throws Exception {
        return new JSONObject().put("ok", true);
    }

    static JSONObject refus() throws Exception {
        return new JSONObject().put("ok", false).put("reason", "fond");
    }

    private JSONObject repondre(String plugin, String m, JSONObject o) throws Exception {
        switch (plugin) {
            case "KladVault": return coffre(m, o);
            case "KladGrafit": return grafit(m, o);
            case "KladWidget":
                if ("ecrire".equals(m)) {
                    WidgetKlad.ecrire(ctx, o.optString("json", null));
                    return ok();
                }
                return refus();
            case "KladArret": return ok().put("ligne", JSONObject.NULL);
            case "App":
                if ("getState".equals(m)) return new JSONObject().put("isActive", false);
                return new JSONObject();
            case "KladReseau": return ok().put("ip", "");
            default: return refus();
        }
    }

    private JSONObject coffre(String m, JSONObject o) throws Exception {
        switch (m) {
            case "status":
                return new JSONObject().put("exists", coffre.existe()).put("bio", "non").put("bioAvailable", false).put("waitMs", 0)
                    .put("failures", 0).put("strongBox", coffre.strongBox()).put("fond", coffre.actif());
            case "unlockFond": {
                byte[] dek = coffre.dek();
                if (dek == null) return refus();
                try {
                    return ok().put("dek", Base64.getEncoder().encodeToString(dek));
                } finally {
                    Arrays.fill(dek, (byte) 0);
                }
            }
            case "readBlob": {
                byte[] b = coffre.lire(o.getString("name"));
                return ok().put("data", b == null ? JSONObject.NULL : Base64.getEncoder().encodeToString(b));
            }
            case "writeBlob":
                if (!FondEtat.ecriturePermise()) throw new IllegalStateException("Klad ouvert : écriture laissée à l'appli");
                coffre.ecrire(o.getString("name"), Base64.getDecoder().decode(o.optString("data", "")));
                return ok();
            case "deleteBlob":
                if (!FondEtat.ecriturePermise()) throw new IllegalStateException("Klad ouvert : écriture laissée à l'appli");
                coffre.effacer(o.getString("name"));
                return ok();
            case "resultatEnregistrement":
                return ok().put("resultat", JSONObject.NULL);
            default:
                return refus();
        }
    }

    private JSONObject grafit(String m, JSONObject o) throws Exception {
        Stockage st = GrafitProvider.stockage(ctx);
        switch (m) {
            case "ecrire":
                st.ecrire(o.getString("json"), System.currentTimeMillis());
                ctx.getContentResolver().notifyChange(GrafitProvider.uri(ctx), null);
                return ok();
            case "effacer": {
                boolean e = st.effacer();
                ctx.getContentResolver().notifyChange(GrafitProvider.uri(ctx), null);
                return ok().put("existait", e);
            }
            case "lire": {
                Resume.Lu lu = st.lire();
                return ok().put("json", lu == null ? JSONObject.NULL : lu.json).put("updated_at", lu == null ? 0L : lu.misAJour);
            }
            default:
                return ok();
        }
    }
}

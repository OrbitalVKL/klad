package app.klad.fond;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;

/**
 * Une synchro planifiée (2.3.0) : l'appli elle-même (index.html), chargée dans une WebView invisible avec le pont de
 * fond (www/fond.js + Pont). La page ouvre le coffre par l'enveloppe « arrière-plan », synchronise comme l'appli (sans
 * en-têtes « utilisateur présent »), enregistre, met à jour le widget et le résumé Grafit, puis appelle fin().
 * Fil principal ; 4 minutes au plus. Aucune navigation hors de https://localhost/.
 */
final class Execution {

    static final long DELAI_MS = 4 * 60_000L;
    static final String ADRESSE = "https://localhost/index.html";

    interface Fin {
        void apres(String raison);
    }

    private final Context ctx;
    private final Fin fin;
    private final Handler h = new Handler(Looper.getMainLooper());
    private WebView web;
    private boolean fini;

    Execution(Context ctx, Fin fin) {
        this.ctx = ctx.getApplicationContext();
        this.fin = fin;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    void lancer() {
        WebViewAssetLoader chargeur = new WebViewAssetLoader.Builder().setDomain("localhost").addPathHandler("/", new Pages(ctx)).build();
        web = new WebView(ctx);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                WebResourceResponse rep = chargeur.shouldInterceptRequest(r.getUrl());
                if (rep != null) return rep;
                // rien d'autre n'est chargé par la page (le réseau passe par le pont)
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", null, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                web = null;          // déjà perdue
                terminer("moteur");
                return true;
            }
        });
        web.addJavascriptInterface(new Pont(ctx, this), "KladFondPont");
        web.loadUrl(ADRESSE);
        h.postDelayed(() -> terminer("delai"), DELAI_MS);
    }

    /** Fin (depuis n'importe quel fil) : une seule fois, WebView détruite. */
    void terminer(String raison) {
        h.post(() -> {
            if (fini) return;
            fini = true;
            h.removeCallbacksAndMessages(null);
            if (web != null) {
                try {
                    web.stopLoading();
                    web.removeJavascriptInterface("KladFondPont");
                    web.destroy();
                } catch (Exception ignored) {
                    // déjà détruite
                }
                web = null;
            }
            fin.apres(raison);
        });
    }
}

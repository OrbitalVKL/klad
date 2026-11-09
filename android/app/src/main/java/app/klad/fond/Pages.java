package app.klad.fond;

import android.content.Context;
import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Fichiers de l'appli (assets/public, copiés par Capacitor) servis à la page de fond sous https://localhost/ (2.3.0).
 * index.html reçoit en tête www/fond.js, qui remplace le pont Capacitor par le pont de fond (Pont).
 */
final class Pages implements WebViewAssetLoader.PathHandler {

    static final String INJECTION = "<script src=\"fond.js\"></script>";
    private final AssetManager assets;

    Pages(Context ctx) {
        assets = ctx.getAssets();
    }

    /** index.html avec www/fond.js chargé avant tout autre script. */
    static String injecter(String html) {
        int i = html.indexOf("<head>");
        if (i < 0) return INJECTION + html;
        return html.substring(0, i + 6) + INJECTION + html.substring(i + 6);
    }

    static String type(String chemin) {
        String c = chemin.toLowerCase(java.util.Locale.ROOT);
        if (c.endsWith(".html")) return "text/html";
        if (c.endsWith(".js") || c.endsWith(".mjs")) return "application/javascript";
        if (c.endsWith(".css")) return "text/css";
        if (c.endsWith(".json")) return "application/json";
        if (c.endsWith(".svg")) return "image/svg+xml";
        if (c.endsWith(".png")) return "image/png";
        if (c.endsWith(".woff2")) return "font/woff2";
        if (c.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    static boolean cheminValide(String chemin) {
        return chemin != null && !chemin.contains("..") && !chemin.startsWith("/") && chemin.matches("[A-Za-z0-9._/-]*");
    }

    @Override
    public WebResourceResponse handle(String chemin) {
        try {
            if (chemin == null || chemin.isEmpty()) chemin = "index.html";
            if (!cheminValide(chemin)) return null;
            byte[] b = lire("public/" + chemin);
            if ("index.html".equals(chemin)) b = injecter(new String(b, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
            String t = type(chemin);
            return new WebResourceResponse(t, t.startsWith("text/") || t.endsWith("javascript") || t.endsWith("json") ? "UTF-8" : null, new ByteArrayInputStream(b));
        } catch (Exception e) {
            return null;
        }
    }

    private byte[] lire(String chemin) throws java.io.IOException {
        try (InputStream in = assets.open(chemin); ByteArrayOutputStream o = new ByteArrayOutputStream()) {
            byte[] b = new byte[16384];
            int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            return o.toByteArray();
        }
    }
}

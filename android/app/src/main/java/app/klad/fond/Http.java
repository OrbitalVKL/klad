package app.klad.fond;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/**
 * Requêtes réseau de la synchro planifiée (2.3.0) : seulement l'API Enable Banking, en HTTPS (la page de fond n'a
 * pas le relais réseau de Capacitor). Aucune URL, en-tête ni contenu n'est journalisé.
 */
final class Http {

    static final String HOTE = "api.enablebanking.com";
    static final int DELAI_MS = 30_000;
    static final int MAX_OCTETS = 16 * 1024 * 1024;

    private Http() {}

    /** Seule adresse permise : https://api.enablebanking.com/… (port par défaut). */
    static boolean autorise(String url) {
        try {
            URI u = new URI(url);
            return "https".equals(u.getScheme()) && HOTE.equalsIgnoreCase(u.getHost()) && (u.getPort() == -1 || u.getPort() == 443)
                && u.getUserInfo() == null;
        } catch (Exception e) {
            return false;
        }
    }

    static boolean methodePermise(String m) {
        return "GET".equals(m) || "POST".equals(m) || "DELETE".equals(m) || "PUT".equals(m);
    }

    /** → JSON { status, headers: { nom: valeur }, body } ou { erreur }. */
    static String requete(String methode, String url, String entetes, String corps) {
        JSONObject r = new JSONObject();
        HttpURLConnection c = null;
        try {
            String m = methode == null ? "GET" : methode.toUpperCase(java.util.Locale.ROOT);
            if (!autorise(url) || !methodePermise(m)) return r.put("erreur", "Adresse refusée").toString();
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod(m);
            c.setConnectTimeout(DELAI_MS);
            c.setReadTimeout(DELAI_MS);
            c.setInstanceFollowRedirects(false);
            c.setUseCaches(false);
            if (entetes != null && !entetes.isEmpty()) {
                JSONObject h = new JSONObject(entetes);
                for (java.util.Iterator<String> it = h.keys(); it.hasNext(); ) {
                    String k = it.next();
                    c.setRequestProperty(k, h.optString(k, ""));
                }
            }
            if (corps != null && !corps.isEmpty() && !"GET".equals(m)) {
                c.setDoOutput(true);
                byte[] b = corps.getBytes(StandardCharsets.UTF_8);
                try (OutputStream o = c.getOutputStream()) {
                    o.write(b);
                }
            }
            int st = c.getResponseCode();
            JSONObject hs = new JSONObject();
            for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                if (e.getKey() != null && e.getValue() != null && !e.getValue().isEmpty()) hs.put(e.getKey().toLowerCase(java.util.Locale.ROOT), e.getValue().get(0));
            }
            InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream();
            String body = in == null ? "" : lire(in);
            return r.put("status", st).put("headers", hs).put("body", body).toString();
        } catch (Exception e) {
            try {
                return r.put("erreur", "Réseau indisponible (" + e.getClass().getSimpleName() + ")").toString();
            } catch (Exception e2) {
                return "{\"erreur\":\"Réseau indisponible\"}";
            }
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String lire(InputStream in) throws IOException {
        try (InputStream i = in; ByteArrayOutputStream o = new ByteArrayOutputStream()) {
            byte[] b = new byte[16384];
            int n;
            while ((n = i.read(b)) > 0) {
                o.write(b, 0, n);
                if (o.size() > MAX_OCTETS) throw new IOException("Réponse trop grosse");
            }
            return new String(o.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}

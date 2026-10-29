package app.klad.affichage;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin local « KladAffichage » : barres d'état et de navigation accordées au thème affiché par l'appli.
 *   appliquer({ sombre, fond }) : icônes claires sur fond sombre (ou l'inverse), fond des barres et de la fenêtre
 *   à la couleur de la page (« #rrggbb »), pour qu'aucune bande ne reste d'une autre couleur.
 * Le thème lui-même est choisi par l'appli (Auto / Clair / Sombre) ; la WebView ne l'assombrit jamais d'elle-même
 * (voir MainActivity).
 */
@CapacitorPlugin(name = "KladAffichage")
public class KladAffichagePlugin extends Plugin {

    @PluginMethod
    public void appliquer(PluginCall call) {
        final boolean sombre = Boolean.TRUE.equals(call.getBoolean("sombre", false));
        final Integer fond = couleur(call.getString("fond"));
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            View decor = w.getDecorView();
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, decor);
            c.setAppearanceLightStatusBars(!sombre);
            c.setAppearanceLightNavigationBars(!sombre);
            if (fond != null) {
                decor.setBackgroundColor(fond);
                getBridge().getWebView().setBackgroundColor(fond);
                if (Build.VERSION.SDK_INT < 35) barres(w, fond);
            }
            call.resolve(new JSObject().put("ok", true));
        });
    }

    /** Avant Android 15, les barres ont leur propre couleur (ensuite, la fenêtre s'affiche dessous). */
    @SuppressWarnings("deprecation")
    private static void barres(Window w, int fond) {
        w.setStatusBarColor(fond);
        w.setNavigationBarColor(fond);
    }

    /** « #rrggbb » → couleur opaque ; null si illisible. */
    static Integer couleur(String s) {
        if (s == null || !s.matches("#[0-9a-fA-F]{6}")) return null;
        return Color.rgb(Integer.parseInt(s.substring(1, 3), 16), Integer.parseInt(s.substring(3, 5), 16), Integer.parseInt(s.substring(5, 7), 16));
    }
}

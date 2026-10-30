package app.klad.affichage;

import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin local « KladAffichage » : barres d'état et de navigation accordées au thème affiché par l'appli.
 *   appliquer({ sombre, fond }) : icônes claires sur fond sombre (ou l'inverse), fond des barres et de la fenêtre
 *   à la couleur de la page (« #rrggbb »), pour qu'aucune bande ne reste d'une autre couleur.
 *   captures({ autoriser }) (0.10.9) : captures d'écran autorisées seulement pendant le mode démo (données affichées
 *   fictives) ; FLAG_SECURE retiré en entrant dans le mode démo, rétabli en sortant, au verrouillage, et dès que l'appli
 *   passe en arrière-plan (aperçu des applis récentes jamais lisible).
 *   diagnostic() (0.10.9) : modèle, versions d'Android et de la WebView, taille du texte, densité, marges du système ;
 *   aucune donnée personnelle ni identifiant de l'appareil.
 * Le thème lui-même est choisi par l'appli (Auto / Clair / Sombre) ; la WebView ne l'assombrit jamais d'elle-même
 * (voir MainActivity).
 */
@CapacitorPlugin(name = "KladAffichage")
public class KladAffichagePlugin extends Plugin {

    /** Mode démo actif côté appli : captures d'écran autorisées tant que l'appli est au premier plan. */
    private boolean capturesDemo = false;

    @PluginMethod
    public void captures(PluginCall call) {
        final boolean autoriser = Boolean.TRUE.equals(call.getBoolean("autoriser", false));
        getActivity().runOnUiThread(() -> {
            capturesDemo = autoriser;
            proteger(getActivity().getWindow(), !autoriser);
            call.resolve(new JSObject().put("captures", autoriser));
        });
    }

    /** FLAG_SECURE posé (aucune capture, aperçu masqué) ou retiré. */
    static void proteger(Window w, boolean oui) {
        if (oui) w.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else w.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        proteger(getActivity().getWindow(), true);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (capturesDemo) proteger(getActivity().getWindow(), false);
    }

    @PluginMethod
    public void diagnostic(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject o = new JSObject();
            o.put("fabricant", Build.MANUFACTURER);
            o.put("modele", Build.MODEL);
            o.put("android", Build.VERSION.RELEASE);
            o.put("sdk", Build.VERSION.SDK_INT);
            PackageInfo p = WebViewCompat.getCurrentWebViewPackage(getContext());
            o.put("webview", p != null ? p.packageName + " " + p.versionName : "inconnue");
            WebView wv = getBridge().getWebView();
            o.put("textZoom", wv.getSettings().getTextZoom());
            Configuration c = getContext().getResources().getConfiguration();
            o.put("echellePolice", c.fontScale);
            o.put("largeurDp", c.screenWidthDp);
            o.put("hauteurDp", c.screenHeightDp);
            DisplayMetrics m = getContext().getResources().getDisplayMetrics();
            o.put("densite", m.density);
            o.put("dpi", m.densityDpi);
            o.put("dpiStandard", DisplayMetrics.DENSITY_DEVICE_STABLE);
            o.put("webviewPx", wv.getWidth() + " × " + wv.getHeight());
            WindowInsetsCompat ins = ViewCompat.getRootWindowInsets(wv);
            if (ins != null) {
                Insets s = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                o.put("margesPx", s.left + " " + s.top + " " + s.right + " " + s.bottom);
            }
            o.put("captures", capturesDemo);
            call.resolve(o);
        });
    }

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

package app.klad;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import app.klad.affichage.KladAffichagePlugin;
import app.klad.grafit.KladGrafitPlugin;
import app.klad.mail.KladMailPlugin;
import app.klad.reseau.KladReseauPlugin;
import app.klad.update.KladUpdatePlugin;
import app.klad.vault.KladVaultPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KladVaultPlugin.class);
        registerPlugin(KladUpdatePlugin.class);
        registerPlugin(KladReseauPlugin.class);
        registerPlugin(KladGrafitPlugin.class);
        registerPlugin(KladMailPlugin.class);
        registerPlugin(KladAffichagePlugin.class);
        super.onCreate(savedInstanceState);
        // Pas de capture d'écran ni d'aperçu lisible dans les applis récentes.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
        // Le thème (Auto / Clair / Sombre) est celui de l'appli : la WebView ne doit pas assombrir la page d'elle-même.
        sansAssombrissement(getBridge().getWebView().getSettings());
    }

    @SuppressWarnings("deprecation")
    static void sansAssombrissement(WebSettings s) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, false);
        else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) WebSettingsCompat.setForceDark(s, WebSettingsCompat.FORCE_DARK_OFF);
    }
}

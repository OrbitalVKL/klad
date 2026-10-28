package app.klad;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
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
        super.onCreate(savedInstanceState);
        // Pas de capture d'écran ni d'aperçu lisible dans les applis récentes.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
    }
}

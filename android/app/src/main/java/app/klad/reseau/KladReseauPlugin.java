package app.klad.reseau;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Plugin local « KladReseau » : adresse IP du téléphone, envoyée à Enable Banking dans l'en-tête Psu-Ip-Address
 * lors d'une récupération lancée par l'utilisateur. Rien n'est demandé à un service tiers ; rien n'est journalisé.
 */
@CapacitorPlugin(name = "KladReseau")
public class KladReseauPlugin extends Plugin {

    @PluginMethod
    public void adresse(PluginCall call) {
        JSObject r = new JSObject();
        try {
            List<InetAddress> toutes = new ArrayList<>();
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                toutes.addAll(Collections.list(ni.getInetAddresses()));
            }
            String ip = Adresse.choisir(toutes);
            r.put("ip", ip == null ? "" : ip);
        } catch (Exception e) {
            r.put("ip", "");
        }
        call.resolve(r);
    }
}

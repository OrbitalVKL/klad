package app.klad.reseau;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.util.List;

/**
 * Choix de l'adresse IP du téléphone pour l'en-tête « Psu-Ip-Address » (utilisateur présent) d'Enable Banking.
 * Aucun service tiers n'est interrogé : on prend l'adresse IPv6 globale du téléphone si elle existe (c'est alors son
 * adresse publique), sinon son adresse IPv4 (souvent locale). Logique pure, testée par JUnit.
 */
final class Adresse {

    private Adresse() {}

    /** IPv6 globale (ni locale au lien, ni locale au site, ni unique locale fc00::/7, ni multidiffusion). */
    static boolean ipv6Globale(InetAddress a) {
        if (!(a instanceof Inet6Address)) return false;
        if (a.isLoopbackAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress() || a.isAnyLocalAddress() || a.isMulticastAddress()) {
            return false;
        }
        byte b0 = a.getAddress()[0];
        return (b0 & 0xfe) != 0xfc;
    }

    static boolean ipv4Utilisable(InetAddress a) {
        return a instanceof Inet4Address && !a.isLoopbackAddress() && !a.isLinkLocalAddress() && !a.isAnyLocalAddress() && !a.isMulticastAddress();
    }

    /** Adresse retenue, sans indice de zone (« %wlan0 ») ; null si aucune. */
    static String choisir(List<InetAddress> adresses) {
        InetAddress v4 = null;
        for (InetAddress a : adresses) {
            if (ipv6Globale(a)) return texte(a);
            if (v4 == null && ipv4Utilisable(a)) v4 = a;
        }
        return v4 == null ? null : texte(v4);
    }

    static String texte(InetAddress a) {
        String s = a.getHostAddress();
        int i = s.indexOf('%');
        return i < 0 ? s : s.substring(0, i);
    }
}

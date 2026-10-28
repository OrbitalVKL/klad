package app.klad.reseau;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.net.InetAddress;
import java.util.Arrays;
import org.junit.Test;

/** Tests JVM du choix de l'adresse IP (adresses de documentation, fictives). */
public class AdresseTest {

    private static InetAddress ip(String s) throws Exception {
        return InetAddress.getByName(s);
    }

    @Test
    public void ipv6GlobalePreferee() throws Exception {
        assertEquals("2001:db8:0:0:0:0:0:1", Adresse.choisir(Arrays.asList(ip("192.168.1.20"), ip("fe80::1"), ip("2001:db8::1"))));
    }

    @Test
    public void sinonIpv4() throws Exception {
        assertEquals("192.168.1.20", Adresse.choisir(Arrays.asList(ip("fe80::1"), ip("fd00::5"), ip("127.0.0.1"), ip("192.168.1.20"))));
        assertEquals("100.64.0.7", Adresse.choisir(Arrays.asList(ip("100.64.0.7"))));
    }

    @Test
    public void aucune() throws Exception {
        assertNull(Adresse.choisir(Arrays.asList(ip("127.0.0.1"), ip("::1"), ip("169.254.0.3"))));
        assertNull(Adresse.choisir(Arrays.asList()));
    }

    @Test
    public void filtres() throws Exception {
        assertFalse(Adresse.ipv6Globale(ip("fc00::1")));
        assertFalse(Adresse.ipv6Globale(ip("ff02::1")));
        assertFalse(Adresse.ipv6Globale(ip("192.0.2.1")));
        assertTrue(Adresse.ipv6Globale(ip("2a01:db8::2")));
        assertTrue(Adresse.ipv4Utilisable(ip("192.0.2.1")));
        assertFalse(Adresse.ipv4Utilisable(ip("169.254.1.1")));
    }
}

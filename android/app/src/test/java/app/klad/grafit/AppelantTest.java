package app.klad.grafit;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

/** Tests JVM du contrôle de l'appelant du GrafitProvider (paquets et empreintes fictifs, sauf celle de Grafit). */
public class AppelantTest {

    private static final byte[] BONNE = GrafitConfig.certificat();
    private static final byte[] FAUSSE = GrafitConfig.hex("00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF");

    /** Faux gestionnaire de paquets : UID → paquets, paquet → empreinte de signature. */
    private static final class Faux implements Appelant.Paquets {
        final Map<Integer, String[]> uids = new HashMap<>();
        final Map<String, byte[]> certs = new HashMap<>();
        String dernierControle;

        Faux uid(int uid, String... paquets) {
            uids.put(uid, paquets);
            return this;
        }

        Faux cert(String paquet, byte[] sha) {
            certs.put(paquet, sha);
            return this;
        }

        @Override
        public String[] pourUid(int uid) {
            return uids.get(uid);
        }

        @Override
        public boolean signePar(String paquet, byte[] sha256) {
            dernierControle = paquet;
            return certs.containsKey(paquet) && Arrays.equals(certs.get(paquet), sha256);
        }
    }

    private static void refuse(int uid, Faux pm) {
        assertFalse(Appelant.autorise(uid, pm));
        try {
            Appelant.verifier(uid, pm);
            fail("SecurityException attendue");
        } catch (SecurityException attendu) {
            // refusé
        }
    }

    @Test
    public void configuration() {
        assertEquals("fr.orbitalvkl.grafit", GrafitConfig.PACKAGE);
        assertEquals(32, BONNE.length);
        assertEquals((byte) 0xD3, BONNE[0]);
        assertEquals((byte) 0xFC, BONNE[31]);
        assertEquals("io.github.compte.klad.grafit", GrafitConfig.authority("io.github.compte.klad"));
        assertArrayEquals(new byte[] {(byte) 0xAB, 0x01}, GrafitConfig.hex("ab01"));
    }

    @Test
    public void grafitValide() {
        Faux pm = new Faux().uid(10123, GrafitConfig.PACKAGE).cert(GrafitConfig.PACKAGE, BONNE);
        assertTrue(Appelant.autorise(10123, pm));
        Appelant.verifier(10123, pm);
        assertEquals(GrafitConfig.PACKAGE, pm.dernierControle);
    }

    @Test
    public void paquetFaux() {
        // même empreinte, mais un autre paquet ; ou un nom ressemblant
        refuse(10124, new Faux().uid(10124, "fr.orbitalvkl.autre").cert("fr.orbitalvkl.autre", BONNE));
        refuse(10125, new Faux().uid(10125, "fr.orbitalvkl.grafit.faux").cert("fr.orbitalvkl.grafit.faux", BONNE));
        refuse(2000, new Faux().uid(2000, "com.android.shell"));                       // adb shell content query
        refuse(10126, new Faux());                                                       // UID inconnu
        refuse(10127, new Faux().uid(10127));                                            // aucun paquet
    }

    @Test
    public void empreinteFausse() {
        refuse(10123, new Faux().uid(10123, GrafitConfig.PACKAGE).cert(GrafitConfig.PACKAGE, FAUSSE));
        refuse(10123, new Faux().uid(10123, GrafitConfig.PACKAGE));                     // non signé
    }

    @Test
    public void uidPartage() {
        // UID partagé sans Grafit : refusé, même si un des paquets porte la bonne empreinte
        refuse(10200, new Faux().uid(10200, "com.exemple.a", "com.exemple.b").cert("com.exemple.a", BONNE));
        // UID partagé avec Grafit : c'est la signature de Grafit qui est contrôlée
        Faux pm = new Faux().uid(10201, "com.exemple.a", GrafitConfig.PACKAGE).cert("com.exemple.a", BONNE).cert(GrafitConfig.PACKAGE, FAUSSE);
        refuse(10201, pm);
        assertEquals(GrafitConfig.PACKAGE, pm.dernierControle);
        assertTrue(Appelant.autorise(10202, new Faux().uid(10202, "com.exemple.a", GrafitConfig.PACKAGE).cert(GrafitConfig.PACKAGE, BONNE)));
    }

    @Test
    public void erreursDuGestionnaire() {
        Appelant.Paquets casse = new Appelant.Paquets() {
            @Override
            public String[] pourUid(int uid) {
                throw new IllegalStateException("panne");
            }

            @Override
            public boolean signePar(String paquet, byte[] sha256) {
                return true;
            }
        };
        assertFalse(Appelant.autorise(10123, casse));
        assertFalse(Appelant.autorise(10123, null));
    }
}

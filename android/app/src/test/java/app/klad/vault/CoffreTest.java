package app.klad.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.AEADBadTagException;
import javax.crypto.spec.SecretKeySpec;
import org.junit.Test;

/** Tests JVM de la logique pure du coffre (sans Keystore). */
public class CoffreTest {

    private final SecureRandom rnd = new SecureRandom();
    private static final int ITER = 1000; // rapide pour les tests ; le téléphone calibre ≈ 0,5 s

    private byte[] random(int n) {
        byte[] b = new byte[n];
        rnd.nextBytes(b);
        return b;
    }

    @Test
    public void enveloppeCodeAllerRetour() throws Exception {
        byte[] dek = random(Coffre.DEK_BYTES);
        byte[] salt = random(Coffre.SALT_BYTES);
        byte[] env = Coffre.wrapPin(dek, "123456".toCharArray(), salt, ITER, rnd);
        assertEquals(12 + 32 + 16, env.length);
        assertArrayEquals(dek, Coffre.unwrapPin(env, "123456".toCharArray(), salt, ITER));
    }

    @Test
    public void codeFauxRefuse() throws Exception {
        byte[] salt = random(Coffre.SALT_BYTES);
        byte[] env = Coffre.wrapPin(random(32), "123456".toCharArray(), salt, ITER, rnd);
        assertThrows(AEADBadTagException.class, () -> Coffre.unwrapPin(env, "123457".toCharArray(), salt, ITER));
        assertThrows(AEADBadTagException.class, () -> Coffre.unwrapPin(env, "123456".toCharArray(), random(16), ITER));
        assertThrows(AEADBadTagException.class, () -> Coffre.unwrapPin(env, "123456".toCharArray(), salt, ITER + 1));
    }

    @Test
    public void enveloppeAltereeRefusee() throws Exception {
        SecretKeySpec k = new SecretKeySpec(random(32), "AES");
        byte[] blob = Coffre.seal(k, "secret".getBytes("UTF-8"), Coffre.AAD_DEVICE, rnd);
        for (int i = 0; i < blob.length; i++) {
            byte[] bad = Arrays.copyOf(blob, blob.length);
            bad[i] ^= 1;
            assertThrows(AEADBadTagException.class, () -> Coffre.open(k, bad, Coffre.AAD_DEVICE));
        }
        assertThrows(AEADBadTagException.class, () -> Coffre.open(k, blob, Coffre.AAD_BIO));
        assertEquals("secret", new String(Coffre.open(k, blob, Coffre.AAD_DEVICE), "UTF-8"));
    }

    @Test
    public void ivAleatoires() throws Exception {
        SecretKeySpec k = new SecretKeySpec(random(32), "AES");
        byte[] a = Coffre.seal(k, new byte[8], Coffre.AAD_PIN, rnd);
        byte[] b = Coffre.seal(k, new byte[8], Coffre.AAD_PIN, rnd);
        assertNotEquals(Arrays.toString(Arrays.copyOf(a, 12)), Arrays.toString(Arrays.copyOf(b, 12)));
    }

    @Test
    public void delais() {
        for (int n = 0; n <= 4; n++) assertEquals(0, Coffre.delayMs(n));
        assertEquals(30_000, Coffre.delayMs(5));
        assertEquals(60_000, Coffre.delayMs(6));
        assertEquals(300_000, Coffre.delayMs(7));
        assertEquals(900_000, Coffre.delayMs(8));
        assertEquals(1_800_000, Coffre.delayMs(9));
        assertEquals(3_600_000, Coffre.delayMs(10));
        assertEquals(3_600_000, Coffre.delayMs(50));
    }

    @Test
    public void attenteRestante() {
        assertEquals(0, Coffre.waitMs(4, 1000, 1000));
        assertEquals(30_000, Coffre.waitMs(5, 1000, 1000));
        assertEquals(20_000, Coffre.waitMs(5, 1000, 11_000));
        assertEquals(0, Coffre.waitMs(5, 1000, 31_000));
        assertEquals(30_000, Coffre.waitMs(5, 50_000, 1000)); // horloge reculée : délai complet
    }

    @Test
    public void calibrage() {
        // 20 000 itérations en 50 ms → 200 000 pour 0,5 s
        assertEquals(200_000, Coffre.calibrate(50_000_000L));
        assertEquals(Coffre.ITER_MIN, Coffre.calibrate(1_000_000_000L));
        assertEquals(Coffre.ITER_MAX, Coffre.calibrate(1));
        assertEquals(Coffre.ITER_MAX, Coffre.calibrate(0));
    }

    @Test
    public void formatDuCode() {
        assertTrue(Coffre.isPin("000000"));
        assertTrue(Coffre.isPin("987654"));
        assertFalse(Coffre.isPin("12345"));
        assertFalse(Coffre.isPin("1234567"));
        assertFalse(Coffre.isPin("12a456"));
        assertFalse(Coffre.isPin(null));
    }
}

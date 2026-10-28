package app.klad.update;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.security.MessageDigest;
import org.junit.Test;

/** Tests JVM de la logique pure de la mise à jour (données fictives). */
public class MajTest {

    @Test
    public void adressesAutorisees() {
        assertTrue(Maj.allowedUrl("https://github.com/compte/klad/releases/download/v0.2.1/klad-0.2.1-10.apk"));
        assertTrue(Maj.allowedUrl("https://github.com/Compte-Test/Mon-Carnet/releases/download/v1.0.0/klad.apk"));
        assertFalse(Maj.allowedUrl("http://github.com/compte/klad/releases/download/v0.2.1/klad.apk"));
        assertFalse(Maj.allowedUrl("https://exemple.test/compte/klad/releases/download/v0.2.1/klad.apk"));
        assertFalse(Maj.allowedUrl("https://github.com.exemple.test/c/k/releases/download/v1/klad.apk"));
        assertFalse(Maj.allowedUrl("https://github.com/compte/klad/releases/download/v0.2.1/klad.zip"));
        assertFalse(Maj.allowedUrl("https://github.com/compte/klad/releases/download/v0.2.1/klad.apk?x=1"));
        assertFalse(Maj.allowedUrl(null));
    }

    @Test
    public void empreintes() throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest("apk fictif".getBytes("UTF-8"));
        String h = Maj.hex(d);
        assertEquals(64, h.length());
        assertTrue(Maj.sameDigest("sha256:" + h, d));
        assertTrue(Maj.sameDigest("SHA256:" + h.toUpperCase(), d));
        assertTrue(Maj.sameDigest(h, d));
        assertFalse(Maj.sameDigest("sha256:" + h.replace(h.charAt(0), h.charAt(0) == 'a' ? 'b' : 'a'), d));
        assertFalse(Maj.sameDigest(null, d));
        assertNull(Maj.expectedSha256("sha256:1234"));
        assertNull(Maj.expectedSha256("md5:" + h));
    }
}

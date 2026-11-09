package app.klad.fond;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class HttpTest {

    @Test
    public void seuleEnableBankingEnHttps() {
        assertTrue(Http.autorise("https://api.enablebanking.com/accounts/x/balances"));
        assertTrue(Http.autorise("https://api.enablebanking.com:443/sessions"));
        assertFalse(Http.autorise("http://api.enablebanking.com/accounts"));
        assertFalse(Http.autorise("https://api.enablebanking.com.exemple.org/accounts"));
        assertFalse(Http.autorise("https://exemple.org/?u=https://api.enablebanking.com"));
        assertFalse(Http.autorise("https://x@api.enablebanking.com/accounts"));
        assertFalse(Http.autorise("https://api.enablebanking.com:8443/accounts"));
        assertFalse(Http.autorise("https://api.github.com/repos"));
        assertFalse(Http.autorise(null));
        assertFalse(Http.methodePermise("TRACE"));
        assertTrue(Http.methodePermise("DELETE"));
    }

    @Test
    public void injectionDeLaPageDeFond() {
        assertEquals("<html><head><script src=\"fond.js\"></script><title>t</title></head>", Pages.injecter("<html><head><title>t</title></head>"));
        assertTrue(Pages.cheminValide("vendor/capacitor.js"));
        assertFalse(Pages.cheminValide("../coffre.properties"));
        assertFalse(Pages.cheminValide("/etc/x"));
        assertEquals("application/javascript", Pages.type("app.js"));
        assertEquals("font/woff2", Pages.type("polices/a.woff2"));
    }
}

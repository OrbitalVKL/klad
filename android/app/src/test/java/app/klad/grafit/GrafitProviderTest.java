package app.klad.grafit;

import static org.junit.Assert.fail;

import org.junit.Test;

/** Tests JVM du GrafitProvider : lecture seule (insert, update et delete refusés). */
public class GrafitProviderTest {

    @Test
    public void insertUpdateDeleteRefuses() {
        GrafitProvider p = new GrafitProvider();
        try {
            p.insert(null, null);
            fail("insert accepté");
        } catch (UnsupportedOperationException attendu) {
            // refusé
        }
        try {
            p.update(null, null, null, null);
            fail("update accepté");
        } catch (UnsupportedOperationException attendu) {
            // refusé
        }
        try {
            p.delete(null, null, null);
            fail("delete accepté");
        } catch (UnsupportedOperationException attendu) {
            // refusé
        }
    }
}

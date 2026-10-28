package app.klad.grafit;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/** Tests JVM du résumé : chiffrement, fichier, curseur, résumé vide (données fictives, clé logicielle). */
public class ResumeTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private static final String JSON = "{\"v\":1,\"state\":\"ok\",\"generated\":1793260800000,\"accounts\":[{\"id\":\"a1b2c3d4\",\"label\":\"COURANT É\",\"kind\":\"current\",\"balance\":12.5}]}";
    private static final long T = 1793260800123L;

    private static SecretKey fictive(int graine) {
        byte[] k = new byte[32];
        Arrays.fill(k, (byte) graine);
        return new SecretKeySpec(k, "AES");
    }

    /** Clé logicielle à la place du Keystore ; créée à la demande comme « klad.resume ». */
    private static final class Cles implements Stockage.Cles {
        SecretKey k;
        int creations;

        @Override
        public SecretKey cle(boolean creer) {
            if (k == null && creer) {
                k = fictive(7);
                creations++;
            }
            return k;
        }
    }

    @Test
    public void allerRetourDuChiffrement() throws Exception {
        byte[] f = Resume.sceller(fictive(1), T, JSON, new SecureRandom());
        assertEquals('K', f[0]);
        assertEquals(1, f[3]);
        assertFalse(new String(f, StandardCharsets.ISO_8859_1).contains("COURANT"));      // rien en clair
        Resume.Lu lu = Resume.ouvrir(fictive(1), f);
        assertEquals(T, lu.misAJour);
        assertEquals(JSON, lu.json);
        // deux chiffrements du même résumé diffèrent (IV aléatoire)
        assertFalse(Arrays.equals(f, Resume.sceller(fictive(1), T, JSON, new SecureRandom())));
    }

    @Test
    public void mauvaiseCleOuFichierAltere() throws Exception {
        byte[] f = Resume.sceller(fictive(1), T, JSON, new SecureRandom());
        try {
            Resume.ouvrir(fictive(2), f);
            fail("clé différente acceptée");
        } catch (GeneralSecurityException attendu) {
            // refusé
        }
        byte[] g = f.clone();
        g[g.length - 1] ^= 1;
        try {
            Resume.ouvrir(fictive(1), g);
            fail("fichier altéré accepté");
        } catch (GeneralSecurityException attendu) {
            // refusé
        }
        try {
            Resume.ouvrir(fictive(1), new byte[] {'X', 'Y', 'Z', 1});
            fail("format inconnu accepté");
        } catch (GeneralSecurityException attendu) {
            // refusé
        }
    }

    @Test
    public void tailleEtForme() {
        StringBuilder b = new StringBuilder("{\"x\":\"");
        while (b.length() < Resume.MAX_JSON - 2) b.append('a');
        b.append("\"}");
        assertEquals(Resume.MAX_JSON, b.length());
        Resume.valider(b.toString());                                // 32 Ko − 1 octet : accepté
        for (String mauvais : new String[] {null, "", "[]", "texte", b.toString().replace("{\"x", "{\"xy")}) {
            try {
                Resume.valider(mauvais);
                fail("accepté : " + (mauvais == null ? "null" : mauvais.length() + " caractères"));
            } catch (IllegalArgumentException attendu) {
                // refusé
            }
        }
    }

    @Test
    public void formatDuCurseur() {
        assertArrayEquals(new String[] {"v", "updated_at", "json"}, Resume.colonnes(null));
        Object[] l = Resume.ligne(Resume.colonnes(null), new Resume.Lu(T, JSON));
        assertEquals(3, l.length);
        assertEquals(Integer.valueOf(1), l[0]);
        assertEquals(Long.valueOf(T), l[1]);
        assertEquals(JSON, l[2]);
        assertArrayEquals(new Object[] {JSON, 1}, Resume.ligne(Resume.colonnes(new String[] {"json", "v"}), new Resume.Lu(T, JSON)));
        try {
            Resume.colonnes(new String[] {"iban"});
            fail("colonne inconnue acceptée");
        } catch (IllegalArgumentException attendu) {
            // refusé
        }
    }

    @Test
    public void videSansFichier() {
        Cles c = new Cles();
        Stockage s = new Stockage(new File(tmp.getRoot(), "klad"), c);
        assertNull(s.lire());
        assertEquals(0, c.creations);                                 // une lecture ne crée pas la clé
        Object[] l = Resume.ligne(Resume.COLONNES, s.lire());
        assertEquals(Integer.valueOf(1), l[0]);
        assertEquals(Long.valueOf(0L), l[1]);
        assertEquals("{\"v\":1,\"state\":\"empty\"}", l[2]);
        assertFalse(s.effacer());
    }

    @Test
    public void stockageEcritureRelectureEffacement() throws Exception {
        Cles c = new Cles();
        File dir = new File(tmp.getRoot(), "klad");
        Stockage s = new Stockage(dir, c);
        s.ecrire(JSON, T);
        assertEquals(1, c.creations);
        assertEquals(JSON, s.lire().json);
        assertEquals(T, s.lire().misAJour);
        // remplacement atomique : aucun fichier temporaire laissé
        String autre = JSON.replace("12.5", "13");
        s.ecrire(autre, T + 1);
        assertEquals(autre, s.lire().json);
        assertArrayEquals(new String[] {"resume.bin"}, dir.list());
        // fichier illisible (clé changée, par exemple après « Tout effacer ») : vide, sans exception
        c.k = fictive(9);
        assertNull(s.lire());
        c.k = fictive(7);
        Files.write(new File(dir, "resume.bin").toPath(), new byte[] {1, 2, 3});
        assertNull(s.lire());
        assertTrue(s.effacer());
        assertNull(s.lire());
        // JSON refusé : rien n'est écrit
        try {
            s.ecrire("[1]", T);
            fail("JSON refusé attendu");
        } catch (IllegalArgumentException attendu) {
            // refusé
        }
        assertFalse(new File(dir, "resume.bin").exists());
    }
}

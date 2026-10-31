package app.klad.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Properties;
import java.util.Random;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/**
 * Fichiers par morceaux (1.0.1) : sauvegarde de taille réelle ou plus écrite par morceaux, copiée en flux, relue et
 * comparée ; échecs sans rien de partiel ; résultat gardé malgré une recréation de l'activité ou un arrêt de l'appli.
 */
public class TransfertTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    /** Fichier choisi, en mémoire. coupure : écriture interrompue après n octets ; perte : la relecture perd des octets. */
    static final class Memoire implements Transfert.Destination {
        byte[] contenu = new byte[0];
        boolean supprime = false;
        boolean suppressionPossible = true;
        long coupure = -1;
        int perte = 0;
        int ouvertures = 0;

        @Override
        public OutputStream ouvrir() {
            ouvertures++;
            final long limite = coupure;
            contenu = new byte[0];
            return new ByteArrayOutputStream() {
                @Override
                public synchronized void write(byte[] b, int off, int len) {
                    if (limite >= 0 && count + len > limite) {
                        super.write(b, off, (int) (limite - count));
                        contenu = toByteArray();
                        throw new IllegalStateException("Réseau perdu");
                    }
                    super.write(b, off, len);
                }

                @Override
                public void close() throws IOException {
                    super.close();
                    contenu = toByteArray();
                }
            };
        }

        @Override
        public InputStream relire() {
            return new ByteArrayInputStream(Arrays.copyOf(contenu, Math.max(0, contenu.length - perte)));
        }

        @Override
        public boolean supprimer() {
            if (!suppressionPossible) return false;
            supprime = true;
            contenu = new byte[0];
            return true;
        }
    }

    private static byte[] hasard(int n, long graine) {
        byte[] b = new byte[n];
        new Random(graine).nextBytes(b);
        return b;
    }

    /** Écrit data dans un nouveau fichier temporaire, par morceaux de la taille maximale. */
    private static String preparer(Transfert t, byte[] data) throws IOException {
        String j = t.ouvrir();
        for (int i = 0; i < data.length; i += Transfert.MAX_MORCEAU)
            t.ajouter(j, Arrays.copyOfRange(data, i, Math.min(data.length, i + Transfert.MAX_MORCEAU)));
        return j;
    }

    @Test
    public void grosseSauvegardeParMorceauxCopieeEtVerifiee() throws Exception {
        // ≈ 5 000 opérations sur 3 ans et des PDF : 24 Mo, bien plus que la limite de 1 Mo qui faisait planter la 1.0.0
        File d = tmp.newFolder();
        Transfert t = new Transfert(d);
        byte[] data = hasard(24 * 1024 * 1024 + 123, 1);
        String j = preparer(t, data);
        assertEquals(data.length, t.taille(j));
        Memoire m = new Memoire();
        Transfert.Resultat r = t.enregistrer(j, m);
        assertTrue(r.message, r.ok);
        assertEquals(data.length, r.taille);
        assertArrayEquals(data, m.contenu);
        assertFalse("fichier temporaire supprimé", t.fichier(j).exists());
    }

    @Test
    public void morceauTropGrosRefuse() throws Exception {
        Transfert t = new Transfert(tmp.newFolder());
        String j = t.ouvrir();
        assertThrows(IOException.class, () -> t.ajouter(j, new byte[Transfert.MAX_MORCEAU + 1]));
        assertThrows(IllegalArgumentException.class, () -> t.ajouter("../../coffre", new byte[1]));
    }

    @Test
    public void ecritureInterrompueRienDePartiel() throws Exception {
        Transfert t = new Transfert(tmp.newFolder());
        byte[] data = hasard(3 * 1024 * 1024, 2);
        String j = preparer(t, data);
        Memoire m = new Memoire();
        m.coupure = 1_000_000;
        Transfert.Resultat r = t.enregistrer(j, m);
        assertFalse(r.ok);
        assertEquals("erreur", r.raison);
        assertTrue("fichier choisi supprimé", m.supprime);
        assertEquals(0, m.contenu.length);
        assertFalse(t.fichier(j).exists());
    }

    @Test
    public void relectureDifferenteRienDePartiel() throws Exception {
        Transfert t = new Transfert(tmp.newFolder());
        String j = preparer(t, hasard(800_000, 3));
        Memoire m = new Memoire();
        m.perte = 10;
        Transfert.Resultat r = t.enregistrer(j, m);
        assertFalse(r.ok);
        assertTrue(r.message, r.message.contains("différent"));
        assertTrue(m.supprime);
        assertEquals(0, m.contenu.length);
    }

    @Test
    public void sansSuppressionPossibleLeFichierEstVide() throws Exception {
        Transfert t = new Transfert(tmp.newFolder());
        String j = preparer(t, hasard(2_000_000, 4));
        Memoire m = new Memoire();
        m.coupure = 500_000;
        m.suppressionPossible = false;
        assertFalse(t.enregistrer(j, m).ok);
        assertFalse(m.supprime);
        assertEquals("fichier choisi vidé", 0, m.contenu.length);
    }

    @Test
    public void recreationDeLActiviteEtResultatGarde() throws Exception {
        // le sélecteur est ouvert ; l'activité (ou l'appli) est recréée : nouvelle instance sur le même dossier
        File d = tmp.newFolder();
        byte[] data = hasard(5 * 1024 * 1024, 5);
        String j = preparer(new Transfert(d), data);
        Transfert apres = new Transfert(d);
        Memoire m = new Memoire();
        Transfert.Resultat r = apres.enregistrer(j, m);
        assertTrue(r.ok);
        apres.noter(j, "sauvegarde", r, 1234L);
        assertArrayEquals(data, m.contenu);
        // l'appli, déverrouillée plus tard, lit le résultat puis l'oublie
        Properties p = new Transfert(d).dernier();
        assertNotNull(p);
        assertEquals(j, p.getProperty("jeton"));
        assertEquals("sauvegarde", p.getProperty("nature"));
        assertEquals("1", p.getProperty("ok"));
        assertEquals(Long.toString(data.length), p.getProperty("taille"));
        new Transfert(d).oublier("0000000000000000");
        assertNotNull("autre jeton : gardé", apres.dernier());
        new Transfert(d).oublier(j);
        assertNull(apres.dernier());
    }

    @Test
    public void fichierPrepareDisparuEchecPropre() throws Exception {
        Transfert t = new Transfert(tmp.newFolder());
        String j = t.ouvrir();
        t.abandonner(j);
        Memoire m = new Memoire();
        Transfert.Resultat r = t.enregistrer(j, m);
        assertFalse(r.ok);
        assertEquals("rien ouvert", 0, m.ouvertures);
        assertFalse(t.enregistrer("pas-un-jeton", m).ok);
    }

    @Test
    public void lectureParMorceaux() throws Exception {
        Transfert t = new Transfert(tmp.newFolder());
        byte[] data = hasard(2 * 1024 * 1024 + 7, 6);
        String j = t.recevoir(new ByteArrayInputStream(data));
        assertEquals(data.length, t.taille(j));
        ByteArrayOutputStream lu = new ByteArrayOutputStream();
        long pos = 0;
        for (;;) {
            byte[] b = t.lire(j, pos, Transfert.MAX_MORCEAU);
            if (b.length == 0) break;
            assertTrue(b.length <= Transfert.MAX_MORCEAU);
            lu.write(b);
            pos += b.length;
        }
        assertArrayEquals(data, lu.toByteArray());
        assertThrows(IOException.class, () -> t.lire(j, 0, Transfert.MAX_MORCEAU + 1));
        t.abandonner(j);
        assertThrows(IOException.class, () -> t.taille(j));
    }

    @Test
    public void fichiersOubliesNettoyes() throws Exception {
        File d = tmp.newFolder();
        Transfert t = new Transfert(d);
        String vieux = t.ouvrir(), recent = t.ouvrir();
        assertTrue(t.fichier(vieux).setLastModified(System.currentTimeMillis() - 2 * Transfert.AGE_MAX_MS));
        assertEquals(1, t.nettoyer(System.currentTimeMillis()));
        assertFalse(t.fichier(vieux).exists());
        assertTrue(t.fichier(recent).exists());
    }
}

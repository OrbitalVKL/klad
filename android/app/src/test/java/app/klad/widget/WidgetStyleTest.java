package app.klad.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WidgetStyleTest {

    @Test
    public void clesEtDefaut() {
        assertEquals(WidgetStyle.BLEU, WidgetStyle.de("bleu"));
        assertEquals(WidgetStyle.VERRE, WidgetStyle.de("verre"));
        assertEquals(WidgetStyle.ORBITAL, WidgetStyle.de("orbital"));
        assertEquals("défaut : Orbital", WidgetStyle.ORBITAL, WidgetStyle.de(null));
        assertEquals(WidgetStyle.ORBITAL, WidgetStyle.de("inconnu"));
        assertTrue(WidgetStyle.connu("verre"));
        assertFalse(WidgetStyle.connu("Verre"));
        assertFalse(WidgetStyle.connu(null));
    }

    private static double lum(int c) {
        double[] v = {(c >> 16 & 255) / 255.0, (c >> 8 & 255) / 255.0, (c & 255) / 255.0};
        for (int i = 0; i < 3; i++) v[i] = v[i] <= 0.03928 ? v[i] / 12.92 : Math.pow((v[i] + 0.055) / 1.055, 2.4);
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    }

    private static double contraste(int a, int b) {
        double x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }

    @Test
    public void lisibiliteSurFondsOpaques() {
        // fonds de res/drawable/w_fond_bleu et w_fond_orbital ; textes ≥ 4,5:1
        int[][] cas = {
            {0xFF1D3A5F, WidgetStyle.BLEU.montant}, {0xFF1D3A5F, WidgetStyle.BLEU.rouge}, {0xFF1D3A5F, WidgetStyle.BLEU.muet}, {0xFF1D3A5F, WidgetStyle.BLEU.ambre},
            {0xFF1E1F24, WidgetStyle.ORBITAL.montant}, {0xFF1E1F24, WidgetStyle.ORBITAL.rouge}, {0xFF1E1F24, WidgetStyle.ORBITAL.muet}, {0xFF1E1F24, WidgetStyle.ORBITAL.ambre},
            {0xFFF6C46E, WidgetStyle.BLEU.pastilleTexte}, {0xFFF1F1F1, WidgetStyle.VERRE.pastilleTexte}, {0xFFC4511F, WidgetStyle.ORBITAL.pastilleTexte}
        };
        for (int[] c : cas) assertTrue(Integer.toHexString(c[1]) + " sur " + Integer.toHexString(c[0]), contraste(c[0], c[1]) >= 4.5);
    }

    @Test
    public void couleurDuMontant() {
        assertEquals(WidgetStyle.ORBITAL.montant, WidgetStyle.ORBITAL.couleur(WidgetDonnees.Couleur.NORMAL));
        assertEquals(WidgetStyle.ORBITAL.rouge, WidgetStyle.ORBITAL.couleur(WidgetDonnees.Couleur.ROUGE));
        assertEquals(WidgetStyle.VERRE.muet, WidgetStyle.VERRE.couleur(WidgetDonnees.Couleur.GRIS));
    }
}

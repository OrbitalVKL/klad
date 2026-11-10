package app.klad.widget;

/**
 * Styles du widget (2.3.1, choisis dans Plus › Apparence), sans Android (testé par JUnit). Couleurs ARGB ; le fond et la
 * pastille sont des formes (res/drawable/w_fond_<cle>[_alerte], w_pastille_<cle>) choisies par WidgetKlad.
 *   bleu    : bleu Klad, pastille ambre ;
 *   verre   : fond sombre translucide (Android ne floute pas le fond d'écran derrière un widget), pastille blanche ;
 *   orbital : couleur des dossiers du lanceur Pixel, bordure et pastille rouille ;
 *   orbital_verre (2.3.2, style par défaut) : fond sombre translucide teinté chaud, bordure et pastille rouille.
 */
public enum WidgetStyle {
    BLEU("bleu", 0xFFFFFFFF, 0xFFFFB6A6, 0xFFC9D6E8, 0xFFF6C46E, 0xFF1B1406),
    VERRE("verre", 0xFFFFFFFF, 0xFFFFAB98, 0xFFDFE2E4, 0xFFF6C46E, 0xFF1E1F24),
    ORBITAL("orbital", 0xFFF6EBE0, 0xFFFF8F73, 0xFFBDB4AD, 0xFFF0A850, 0xFFFFFFFF),
    ORBITAL_VERRE("orbital_verre", 0xFFF8EEE4, 0xFFFFA08A, 0xFFE2D6CC, 0xFFF6B35C, 0xFFFFFFFF);

    public static final WidgetStyle DEFAUT = ORBITAL_VERRE;

    public final String cle;
    public final int montant;
    public final int rouge;
    public final int muet;
    public final int ambre;
    public final int pastilleTexte;

    WidgetStyle(String cle, int montant, int rouge, int muet, int ambre, int pastilleTexte) {
        this.cle = cle;
        this.montant = montant;
        this.rouge = rouge;
        this.muet = muet;
        this.ambre = ambre;
        this.pastilleTexte = pastilleTexte;
    }

    /** Style d'après sa clé ; inconnu ou absent : style par défaut. */
    public static WidgetStyle de(String cle) {
        if (cle != null) {
            for (WidgetStyle s : values()) if (s.cle.equals(cle)) return s;
        }
        return DEFAUT;
    }

    public static boolean connu(String cle) {
        if (cle == null) return false;
        for (WidgetStyle s : values()) if (s.cle.equals(cle)) return true;
        return false;
    }

    /** Couleur du montant selon l'affichage. */
    public int couleur(WidgetDonnees.Couleur c) {
        return c == WidgetDonnees.Couleur.ROUGE ? rouge : c == WidgetDonnees.Couleur.GRIS ? muet : montant;
    }
}

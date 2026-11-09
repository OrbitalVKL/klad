package app.klad.widget;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;

/**
 * Données et affichage du widget d'écran d'accueil (2.3.0), sans Android (testé par JUnit).
 *
 * Données écrites par l'appli (www/widget.js) : reste à vivre (base choisie, centimes, sans signe), dépassé ou non,
 * nombre d'opérations à vérifier, heure de la dernière synchro, banque à reconnecter, mode démo.
 * Affichage (maquette validée le 09/11/2026) : montant sans légende, bleu (rouge s'il est dépassé, jamais de signe
 * moins) ; pastille du nombre à vérifier ; heure de la dernière synchro, en ambre au-delà de 12 h ; « à ouvrir » si la
 * banque est à reconnecter ; « ••• » en mode démo ; « — » sans donnée.
 */
public final class WidgetDonnees {

    public enum Etat { VIDE, DEMO, OK }

    public enum Couleur { BLEU, ROUGE, GRIS }

    public enum Icone { SYNCHRO, HORLOGE, LIEN, CADENAS }

    /** Au-delà, l'heure de la dernière synchro passe en ambre. */
    public static final long ANCIENNE_MS = 12 * 3600_000L;
    static final char ESPACE = ' ';     // espace fine insécable (séparateur des milliers)

    public final Etat etat;
    public final Long rav;          // centimes, valeur absolue ; null : non calculable
    public final boolean epuise;
    public final int aVerifier;
    public final long sync;         // ms ; 0 : jamais
    public final boolean reconnecter;

    public WidgetDonnees(Etat etat, Long rav, boolean epuise, int aVerifier, long sync, boolean reconnecter) {
        this.etat = etat;
        this.rav = rav == null ? null : Math.abs(rav);
        this.epuise = epuise;
        this.aVerifier = Math.max(0, aVerifier);
        this.sync = Math.max(0, sync);
        this.reconnecter = reconnecter;
    }

    public static WidgetDonnees vide() {
        return new WidgetDonnees(Etat.VIDE, null, false, 0, 0, false);
    }

    /** Ce que montre le widget. montant : texte sans « € » (ajouté en petit s'il est chiffré). */
    public static final class Affichage {
        public final String montant;
        public final boolean chiffre;
        public final Couleur couleur;
        public final String pastille;   // null : pas de pastille
        public final String bas;
        public final boolean basAmbre;
        public final Icone icone;
        public final String vue;        // « trier » ou « apercu » (toucher)

        Affichage(String montant, boolean chiffre, Couleur couleur, String pastille, String bas, boolean basAmbre, Icone icone, String vue) {
            this.montant = montant;
            this.chiffre = chiffre;
            this.couleur = couleur;
            this.pastille = pastille;
            this.bas = bas;
            this.basAmbre = basAmbre;
            this.icone = icone;
            this.vue = vue;
        }
    }

    public Affichage affichage(long now, ZoneId zone) {
        if (etat == Etat.VIDE) return new Affichage("—", false, Couleur.GRIS, null, "à ouvrir", true, Icone.LIEN, "apercu");
        if (etat == Etat.DEMO) return new Affichage("•••", false, Couleur.GRIS, null, "—", false, Icone.CADENAS, "apercu");
        boolean chiffre = rav != null;
        String m = chiffre ? montant(rav) : "—";
        Couleur c = !chiffre ? Couleur.GRIS : epuise ? Couleur.ROUGE : Couleur.BLEU;
        String p = aVerifier <= 0 ? null : aVerifier > 99 ? "99+" : Integer.toString(aVerifier);
        String vue = aVerifier > 0 ? "trier" : "apercu";
        if (reconnecter) return new Affichage(m, chiffre, c, p, "à ouvrir", true, Icone.LIEN, vue);
        if (sync <= 0) return new Affichage(m, chiffre, c, p, "—", true, Icone.HORLOGE, vue);
        boolean vieille = now - sync > ANCIENNE_MS;
        return new Affichage(m, chiffre, c, p, heure(sync, now, zone), vieille, vieille ? Icone.HORLOGE : Icone.SYNCHRO, vue);
    }

    /** Euros arrondis, milliers séparés par une espace fine : 112 849 → « 1 128 ». */
    public static String montant(long centimes) {
        long e = Math.round(Math.abs(centimes) / 100.0);
        String s = Long.toString(e);
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            if (i > 0 && (s.length() - i) % 3 == 0) b.append(ESPACE);
            b.append(s.charAt(i));
        }
        return b.toString();
    }

    /** « 14:02 » le jour même, « hier 14:02 » la veille, « 07/11 » avant. */
    public static String heure(long sync, long now, ZoneId zone) {
        ZonedDateTime t = Instant.ofEpochMilli(sync).atZone(zone);
        LocalDate auj = Instant.ofEpochMilli(now).atZone(zone).toLocalDate();
        String hm = String.format(Locale.ROOT, "%02d:%02d", t.getHour(), t.getMinute());
        if (t.toLocalDate().equals(auj)) return hm;
        if (t.toLocalDate().equals(auj.minusDays(1))) return "hier " + hm;
        return String.format(Locale.ROOT, "%02d/%02d", t.getDayOfMonth(), t.getMonthValue());
    }
}

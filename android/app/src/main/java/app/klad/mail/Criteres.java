package app.klad.mail;

import jakarta.mail.search.AndTerm;
import jakarta.mail.search.ComparisonTerm;
import jakarta.mail.search.FromStringTerm;
import jakarta.mail.search.OrTerm;
import jakarta.mail.search.ReceivedDateTerm;
import jakarta.mail.search.SearchTerm;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Critères d'une recherche de courriels : expéditeurs, mots-clés, période, nombre maximal. Logique pure, testée par JUnit.
 * La recherche se fait d'abord sur le serveur (date de réception, expéditeur), puis est affinée ici : expéditeur contenu
 * dans l'adresse, au moins un mot-clé dans le sujet ou le texte (sans casse ni accents).
 */
final class Criteres {

    static final int JOURS_MAX = 800;
    static final int JOURS_DEFAUT = 90;
    static final int MAX_DEFAUT = 50;
    static final int MAX_PLAFOND = 100;

    final List<String> expediteurs;
    final List<String> motsCles;
    final int jours;
    final int max;

    Criteres(List<String> expediteurs, List<String> motsCles, Integer jours, Integer max) {
        this.expediteurs = nettoyer(expediteurs);
        this.motsCles = nettoyer(motsCles);
        int j = jours == null ? JOURS_DEFAUT : jours;
        this.jours = Math.max(0, Math.min(JOURS_MAX, j));
        int m = max == null || max < 1 ? MAX_DEFAUT : max;
        this.max = Math.min(MAX_PLAFOND, m);
    }

    /** Termes normalisés, sans vide ni doublon. */
    private static List<String> nettoyer(List<String> l) {
        List<String> r = new ArrayList<>();
        if (l == null) return Collections.unmodifiableList(r);
        for (String s : l) {
            String n = normaliser(s);
            if (!n.isEmpty() && !r.contains(n)) r.add(n);
        }
        return Collections.unmodifiableList(r);
    }

    /** Minuscules, accents retirés, espaces resserrés. */
    static String normaliser(String s) {
        if (s == null) return "";
        String d = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        d = d.replace("œ", "oe").replace("Œ", "oe").replace("æ", "ae").replace("Æ", "ae");
        return d.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    /** Vrai si l'adresse contient l'un des expéditeurs (sans liste : tous). */
    boolean expediteurCorrespond(String adresse) {
        if (expediteurs.isEmpty()) return true;
        String a = normaliser(adresse);
        if (a.isEmpty()) return false;
        for (String e : expediteurs) if (a.contains(e)) return true;
        return false;
    }

    /** Vrai si l'un des mots-clés est dans le sujet ou le texte (sans mot-clé : tous). */
    boolean motsClesTrouves(String sujet, String texte) {
        if (motsCles.isEmpty()) return true;
        String s = normaliser(sujet);
        String t = normaliser(texte);
        for (String m : motsCles) if (s.contains(m) || t.contains(m)) return true;
        return false;
    }

    /** Début de la période : minuit, il y a « jours » jours, dans le fuseau donné. */
    Date depuis(Date maintenant, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz, Locale.ROOT);
        c.setTime(maintenant);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.DAY_OF_MONTH, -jours);
        return c.getTime();
    }

    /** Vrai si la date (réception, sinon envoi) est dans la période. Sans date : écarté. */
    static boolean dansPeriode(Date date, Date depuis) {
        return date != null && !date.before(depuis);
    }

    /** Recherche côté serveur : reçu depuis la date (SINCE) et, s'il y en a, l'un des expéditeurs (FROM). */
    SearchTerm terme(Date depuis) {
        SearchTerm date = new ReceivedDateTerm(ComparisonTerm.GE, depuis);
        if (expediteurs.isEmpty()) return date;
        SearchTerm de;
        if (expediteurs.size() == 1) {
            de = new FromStringTerm(expediteurs.get(0));
        } else {
            SearchTerm[] t = new SearchTerm[expediteurs.size()];
            for (int i = 0; i < t.length; i++) t[i] = new FromStringTerm(expediteurs.get(i));
            de = new OrTerm(t);
        }
        return new AndTerm(date, de);
    }
}

package app.klad.arret;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Journal des plantages (1.0.1), sans Android (testé par JUnit).
 *
 * Un plantage Java (exception non attrapée) ou la perte du moteur de la WebView laisse une ligne ANONYME dans un petit
 * fichier privé ; l'appli la recopie dans son journal au déverrouillage suivant, puis l'efface :
 *   « Klad s'est arrêté pendant <action> : <type d'erreur>, <classe:ligne> (le JJ/MM à HH:MM) ».
 * Jamais de message d'erreur (il peut contenir des données), seulement les noms de classes de l'erreur et l'endroit
 * du code ; l'action est un libellé du code de l'appli, filtré.
 */
public final class Arret {

    private static volatile String action = "";
    private static final String NOM = "arret.txt";

    private Arret() {}

    /** Action en cours (« export de la sauvegarde »…) ; vide : aucune. Lettres, espaces, apostrophes et tirets seulement. */
    public static void action(String a) {
        action = filtrer(a);
    }

    public static String action() {
        return action;
    }

    static String filtrer(String a) {
        if (a == null) return "";
        StringBuilder b = new StringBuilder();
        for (String mot : a.trim().split("\\s+")) {
            if (!mot.matches("[\\p{L}'’-]+")) continue;        // mot avec chiffre, @, ponctuation : écarté
            if (b.length() > 0) b.append(' ');
            b.append(mot);
        }
        return b.length() > 40 ? b.substring(0, 40) : b.toString();
    }

    /** Type d'erreur : nom de la classe, et celui de la cause première s'il diffère. */
    static String type(Throwable e) {
        Throwable r = e;
        for (int i = 0; i < 10 && r.getCause() != null && r.getCause() != r; i++) r = r.getCause();
        String t = e.getClass().getSimpleName();
        String c = r.getClass().getSimpleName();
        return r == e || c.equals(t) ? t : t + " ← " + c;
    }

    /** Endroit : première ligne du code de Klad (paquet app.klad) dans la pile de la cause, sinon première ligne connue. */
    static String endroit(Throwable e) {
        StackTraceElement premier = null;
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            for (StackTraceElement s : t.getStackTrace()) {
                if (premier == null) premier = s;
                if (s.getClassName().startsWith("app.klad.")) return classe(s);
            }
            if (t.getCause() == null) break;
        }
        return premier == null ? "?" : classe(premier);
    }

    private static String classe(StackTraceElement s) {
        String c = s.getClassName();
        c = c.substring(c.lastIndexOf('.') + 1);
        int d = c.indexOf('$');
        if (d > 0) c = c.substring(0, d);
        return c + ":" + s.getLineNumber();
    }

    static String quand(long ms) {
        return new SimpleDateFormat("'le' dd/MM 'à' HH:mm", Locale.FRANCE).format(new Date(ms));
    }

    static String ligne(String action, String quoi, long ms) {
        String a = filtrer(action);
        return "Klad s'est arrêté pendant " + (a.isEmpty() ? "l'utilisation" : a) + " : " + quoi + " (" + quand(ms) + ")";
    }

    /** Ligne pour une exception Java non attrapée. */
    public static String ligne(String action, Throwable e, long ms) {
        return ligne(action, type(e) + ", " + endroit(e), ms);
    }

    /** Ligne pour la perte du moteur d'affichage (WebView). */
    public static String ligneAffichage(String action, boolean plantage, long ms) {
        return ligne(action, plantage ? "moteur d'affichage arrêté (plantage), WebView" : "moteur d'affichage arrêté par Android (mémoire), WebView", ms);
    }

    // ------------------------------------------------------------ fichier

    /** Garde la ligne (la plus récente remplace la précédente). Ne lève jamais : on est en train de planter. */
    public static void noter(File dossier, String ligne) {
        try {
            if (!dossier.isDirectory() && !dossier.mkdirs()) return;
            try (FileOutputStream out = new FileOutputStream(new File(dossier, NOM))) {
                out.write(ligne.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            }
        } catch (Throwable ignored) {
            // rien de plus possible
        }
    }

    public static String lire(File dossier) {
        File f = new File(dossier, NOM);
        if (!f.isFile() || f.length() > 4096) return null;
        byte[] b = new byte[(int) f.length()];
        try (FileInputStream in = new FileInputStream(f)) {
            int n = 0, k;
            while (n < b.length && (k = in.read(b, n, b.length - n)) > 0) n += k;
            return new String(b, 0, n, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    public static void effacer(File dossier) {
        new File(dossier, NOM).delete();
    }

    /** Gestionnaire des exceptions non attrapées : note la ligne, puis laisse Android arrêter l'appli comme avant. */
    public static void installer(final File dossier) {
        final Thread.UncaughtExceptionHandler avant = Thread.getDefaultUncaughtExceptionHandler();
        if (avant instanceof Gestionnaire) return;
        Thread.setDefaultUncaughtExceptionHandler(new Gestionnaire(dossier, avant));
    }

    static final class Gestionnaire implements Thread.UncaughtExceptionHandler {
        private final File dossier;
        private final Thread.UncaughtExceptionHandler avant;

        Gestionnaire(File dossier, Thread.UncaughtExceptionHandler avant) {
            this.dossier = dossier;
            this.avant = avant;
        }

        @Override
        public void uncaughtException(Thread t, Throwable e) {
            try {
                noter(dossier, ligne(action, e, System.currentTimeMillis()));
            } catch (Throwable ignored) {
                // ne pas masquer le plantage d'origine
            }
            if (avant != null) avant.uncaughtException(t, e);
        }
    }
}

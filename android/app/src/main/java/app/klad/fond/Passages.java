package app.klad.fond;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Trace des passages de la synchro planifiée (2.3.4), pour comprendre sans câble ni adb pourquoi un passage n'a rien
 * fait : heure du dernier passage, résultat, dernière étape atteinte, heure du prochain. Préférences « klad.fond » :
 * ni montant, ni nom, ni identifiant. Affiché dans Plus › Verrou › Synchro automatique.
 */
public final class Passages {

    static final String PREFS = "klad.fond";

    private Passages() {}

    private static SharedPreferences p(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Résultat d'un passage (code court : ok, erreurs, reporte, verrou, cle, coffre, ouverture, erreur, delai…). */
    public static void noter(Context ctx, String resultat, String etape) {
        p(ctx).edit().putLong("dernier", System.currentTimeMillis()).putString("resultat", resultat == null ? "?" : resultat)
            .putString("etape", etape == null ? "" : etape).apply();
    }

    /** 2.4.2 : démarrage d'un passage par Android (avant toute décision), pour voir s'il a démarré sans finir. */
    public static void debut(Context ctx) {
        p(ctx).edit().putLong("debut", System.currentTimeMillis()).apply();
    }

    /** 2.4.2 : réveil reçu (AlarmManager). */
    public static void reveil(Context ctx) {
        p(ctx).edit().putLong("reveil", System.currentTimeMillis()).apply();
    }

    public static long demarre(Context ctx) {
        return p(ctx).getLong("debut", 0);
    }

    public static long reveilRecu(Context ctx) {
        return p(ctx).getLong("reveil", 0);
    }

    public static void prochain(Context ctx, long quand) {
        p(ctx).edit().putLong("prochain", quand).apply();
    }

    public static long dernier(Context ctx) {
        return p(ctx).getLong("dernier", 0);
    }

    public static String resultat(Context ctx) {
        return p(ctx).getString("resultat", "");
    }

    public static String etape(Context ctx) {
        return p(ctx).getString("etape", "");
    }

    public static long prochain(Context ctx) {
        return p(ctx).getLong("prochain", 0);
    }

    public static void effacer(Context ctx) {
        p(ctx).edit().clear().apply();
    }
}

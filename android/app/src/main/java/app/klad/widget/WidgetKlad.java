package app.klad.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;
import android.view.View;
import android.widget.RemoteViews;
import app.klad.MainActivity;
import app.klad.R;
import app.klad.grafit.GrafitProvider;
import app.klad.grafit.Resume;
import java.time.ZoneId;
import org.json.JSONObject;

/**
 * Widget d'écran d'accueil 2 × 1 (2.3.0 ; 2 × 1 et style au choix depuis la 2.3.1 ; 2.3.2 : forme d'icône, la carte
 * « w_carte » fait la hauteur d'une icône, en haut de la case, et ne touche plus les bords que le lanceur arrondit,
 * ce qui coupait la bordure), sans logo ni légende : reste à
 * vivre, heure de la dernière synchro, pastille des opérations à vérifier (taille d'une pastille de notification).
 * WidgetKladPetit : même chose en 1 × 1, sans l'heure (alerte sur la bordure).
 * Données relues dans « widget.bin » (chiffré par la clé « klad.resume », lisible appli verrouillée), écrites par
 * l'appli et par la synchro planifiée. Style (bleu, verre, orbital) : préférences « klad.widget », non sensibles.
 * Toucher : Klad sur « Trier » s'il y a une pastille, sinon l'Aperçu (après déverrouillage).
 */
public class WidgetKlad extends AppWidgetProvider {

    static final String PREFS = "klad.widget";
    static final String CLE_STYLE = "style";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        majTous(ctx);
    }

    /** Enregistre les données (JSON de www/widget.js) puis redessine les widgets. */
    public static void ecrire(Context ctx, String json) throws Exception {
        Resume.valider(json);
        new JSONObject(json);
        GrafitProvider.stockageWidget(ctx).ecrire(json, System.currentTimeMillis());
        majTous(ctx);
    }

    public static void effacer(Context ctx) {
        GrafitProvider.stockageWidget(ctx).effacer();
        majTous(ctx);
    }

    /** Style choisi dans Klad ; false si la clé est inconnue. */
    public static boolean choisirStyle(Context ctx, String cle) {
        if (!WidgetStyle.connu(cle)) return false;
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CLE_STYLE, cle).apply();
        majTous(ctx);
        return true;
    }

    static WidgetStyle style(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return WidgetStyle.de(p.getString(CLE_STYLE, null));
    }

    /** Redessine tous les widgets posés, des deux tailles (rien s'il n'y en a pas). Jamais d'exception. */
    public static void majTous(Context ctx) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            if (m == null) return;
            WidgetDonnees d = null;
            WidgetStyle st = null;
            for (int t = 0; t < 2; t++) {
                boolean petit = t == 1;
                int[] ids = m.getAppWidgetIds(new ComponentName(ctx, petit ? WidgetKladPetit.class : WidgetKlad.class));
                if (ids == null || ids.length == 0) continue;
                if (d == null) {
                    d = lire(ctx);
                    st = style(ctx);
                }
                m.updateAppWidget(ids, vues(ctx, d, st, petit));
            }
        } catch (Exception ignored) {
            // widget laissé tel quel
        }
    }

    static WidgetDonnees lire(Context ctx) {
        try {
            Resume.Lu lu = GrafitProvider.stockageWidget(ctx).lire();
            if (lu == null) return WidgetDonnees.vide();
            JSONObject o = new JSONObject(lu.json);
            String e = o.optString("etat", "");
            if ("demo".equals(e)) return new WidgetDonnees(WidgetDonnees.Etat.DEMO, null, false, 0, 0, false);
            if (!"ok".equals(e)) return WidgetDonnees.vide();
            Long rav = o.has("rav") && !o.isNull("rav") ? o.getLong("rav") : null;
            return new WidgetDonnees(WidgetDonnees.Etat.OK, rav, o.optBoolean("epuise", false), o.optInt("av", 0),
                o.optLong("sync", 0), o.optBoolean("reconnecter", false));
        } catch (Exception ex) {
            return WidgetDonnees.vide();
        }
    }

    static int fond(WidgetStyle s, boolean alerte) {
        switch (s) {
            case BLEU: return alerte ? R.drawable.w_fond_bleu_alerte : R.drawable.w_fond_bleu;
            case VERRE: return alerte ? R.drawable.w_fond_verre_alerte : R.drawable.w_fond_verre;
            case ORBITAL: return alerte ? R.drawable.w_fond_orbital_alerte : R.drawable.w_fond_orbital;
            default: return alerte ? R.drawable.w_fond_orbital_verre_alerte : R.drawable.w_fond_orbital_verre;
        }
    }

    static int pastille(WidgetStyle s) {
        switch (s) {
            case BLEU: return R.drawable.w_pastille_bleu;
            case VERRE: return R.drawable.w_pastille_verre;
            default: return R.drawable.w_pastille_orbital;     // orbital et orbital verre : rouille
        }
    }

    static RemoteViews vues(Context ctx, WidgetDonnees d, WidgetStyle st, boolean petit) {
        WidgetDonnees.Affichage a = d.affichage(System.currentTimeMillis(), ZoneId.systemDefault());
        RemoteViews v = new RemoteViews(ctx.getPackageName(), petit ? R.layout.widget_klad_1x1 : R.layout.widget_klad_2x1);
        CharSequence m = a.montant;
        if (a.chiffre) {
            SpannableString s = new SpannableString(a.montant + "€");
            s.setSpan(new RelativeSizeSpan(0.62f), a.montant.length(), s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            m = s;
        }
        v.setTextViewText(R.id.w_montant, m);
        v.setTextColor(R.id.w_montant, st.couleur(a.couleur));
        // 1 × 1 : pas de place pour l'heure, l'alerte (synchro ancienne, banque à reconnecter) passe sur la bordure
        v.setInt(R.id.w_carte, "setBackgroundResource", fond(st, petit && a.basAmbre && d.etat == WidgetDonnees.Etat.OK));
        if (a.pastille == null) v.setViewVisibility(R.id.w_pastille, View.GONE);
        else {
            v.setViewVisibility(R.id.w_pastille, View.VISIBLE);
            v.setTextViewText(R.id.w_pastille, a.pastille);
            v.setTextColor(R.id.w_pastille, st.pastilleTexte);
            v.setInt(R.id.w_pastille, "setBackgroundResource", pastille(st));
        }
        if (!petit) {
            int icone = a.icone == WidgetDonnees.Icone.SYNCHRO ? R.drawable.ic_w_synchro : a.icone == WidgetDonnees.Icone.HORLOGE ? R.drawable.ic_w_horloge
                : a.icone == WidgetDonnees.Icone.LIEN ? R.drawable.ic_w_lien : R.drawable.ic_w_cadenas;
            int c = a.basAmbre ? st.ambre : st.muet;
            v.setImageViewResource(R.id.w_bas_icone, icone);
            v.setInt(R.id.w_bas_icone, "setColorFilter", c);
            v.setTextViewText(R.id.w_bas_texte, a.bas);
            v.setTextColor(R.id.w_bas_texte, c);
        }
        v.setOnClickPendingIntent(R.id.w_racine, ouvrir(ctx, a.vue));
        return v;
    }

    /** Klad ouvert par klad://ouvrir/<vue> (traité après déverrouillage). */
    static PendingIntent ouvrir(Context ctx, String vue) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("klad://ouvrir/" + vue), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, "trier".equals(vue) ? 1 : 2, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}

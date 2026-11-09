package app.klad.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
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
 * Widget d'écran d'accueil (2.3.0), 2 × 2 cases, sans logo ni légende : reste à vivre, pastille des opérations à
 * vérifier, heure de la dernière synchro. Données relues dans « widget.bin » (chiffré par la clé « klad.resume »,
 * lisible appli verrouillée), écrites par l'appli et par la synchro planifiée. Toucher : Klad sur « Trier » s'il y a
 * une pastille, sinon l'Aperçu (après déverrouillage).
 * Les couleurs viennent des ressources (thème clair ou sombre du téléphone, résolu par l'écran d'accueil).
 */
public class WidgetKlad extends AppWidgetProvider {

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

    /** Redessine tous les widgets posés (rien s'il n'y en a pas). Jamais d'exception. */
    public static void majTous(Context ctx) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            if (m == null) return;
            int[] ids = m.getAppWidgetIds(new ComponentName(ctx, WidgetKlad.class));
            if (ids == null || ids.length == 0) return;
            m.updateAppWidget(ids, vues(ctx, lire(ctx)));
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

    static RemoteViews vues(Context ctx, WidgetDonnees d) {
        WidgetDonnees.Affichage a = d.affichage(System.currentTimeMillis(), ZoneId.systemDefault());
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_klad);
        CharSequence m = a.montant;
        if (a.chiffre) {
            SpannableString s = new SpannableString(a.montant + "€");
            s.setSpan(new RelativeSizeSpan(0.6f), a.montant.length(), s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            m = s;
        }
        int[] montants = {R.id.w_montant_bleu, R.id.w_montant_rouge, R.id.w_montant_gris};
        int choisi = a.couleur == WidgetDonnees.Couleur.BLEU ? 0 : a.couleur == WidgetDonnees.Couleur.ROUGE ? 1 : 2;
        for (int i = 0; i < montants.length; i++) {
            v.setViewVisibility(montants[i], i == choisi ? View.VISIBLE : View.GONE);
            if (i == choisi) v.setTextViewText(montants[i], m);
        }
        if (a.pastille == null) v.setViewVisibility(R.id.w_pastille, View.GONE);
        else {
            v.setViewVisibility(R.id.w_pastille, View.VISIBLE);
            v.setTextViewText(R.id.w_pastille, a.pastille);
        }
        int icone = a.icone == WidgetDonnees.Icone.SYNCHRO ? R.drawable.ic_w_synchro : a.icone == WidgetDonnees.Icone.HORLOGE ? R.drawable.ic_w_horloge
            : a.icone == WidgetDonnees.Icone.LIEN ? R.drawable.ic_w_lien : R.drawable.ic_w_cadenas;
        v.setViewVisibility(R.id.w_bas, a.basAmbre ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_bas_ambre, a.basAmbre ? View.VISIBLE : View.GONE);
        v.setImageViewResource(a.basAmbre ? R.id.w_bas_ambre_icone : R.id.w_bas_icone, icone);
        v.setTextViewText(a.basAmbre ? R.id.w_bas_ambre_texte : R.id.w_bas_texte, a.bas);
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

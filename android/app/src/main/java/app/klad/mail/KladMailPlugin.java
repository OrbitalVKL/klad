package app.klad.mail;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import jakarta.mail.FetchProfile;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.UIDFolder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;

/**
 * Plugin local « KladMail » : lecture seule d'une boîte aux lettres IMAP (factures, avis, relevés en PDF).
 *   tester({ hote, port, adresse, motDePasse })   → { ok: true, nb } (nombre de courriels de la boîte de réception)
 *   chercher({ …, expediteurs, motsCles, jours, max }) → { messages: [ { id, date, expediteur, sujet, texte, pieces } ] }
 * IMAP sur TLS seulement (imaps), boîte ouverte en lecture seule : aucun drapeau posé, rien de déplacé, supprimé ni envoyé.
 * Les appels passent sur un fil dédié, l'un après l'autre. Rien n'est journalisé (ni adresse, ni mot de passe, ni contenu) ;
 * les erreurs sont des phrases fixes (Erreurs).
 */
@CapacitorPlugin(name = "KladMail")
public class KladMailPlugin extends Plugin {

    private final ExecutorService fil = Executors.newSingleThreadExecutor(r -> new Thread(r, "klad-mail"));

    /** Travail sur la boîte ouverte en lecture seule. */
    private interface Travail {
        JSObject faire(Folder boite) throws Exception;
    }

    @PluginMethod
    public void tester(PluginCall call) {
        executer(call, boite -> {
            JSObject r = new JSObject();
            r.put("ok", true);
            r.put("nb", boite.getMessageCount());
            return r;
        });
    }

    @PluginMethod
    public void chercher(PluginCall call) {
        Criteres c = new Criteres(liste(call, "expediteurs"), liste(call, "motsCles"), call.getInt("jours"), call.getInt("max"));
        executer(call, boite -> {
            TimeZone tz = TimeZone.getDefault();
            Date depuis = c.depuis(new Date(), tz);
            Message[] trouves = boite.search(c.terme(depuis));
            // En-têtes (expéditeur, sujet, dates) et UID en une fois, avant le tri.
            FetchProfile fp = new FetchProfile();
            fp.add(FetchProfile.Item.ENVELOPE);
            fp.add(UIDFolder.FetchProfileItem.UID);
            fp.add("Message-ID");
            boite.fetch(trouves, fp);
            UIDFolder uids = boite instanceof UIDFolder ? (UIDFolder) boite : null;
            List<Lecture.Courriel> l = Lecture.selectionner(Arrays.asList(trouves), c, depuis, tz,
                m -> uids == null ? "" : "uid:" + uids.getUID(m));
            JSArray messages = new JSArray();
            for (Lecture.Courriel m : l) messages.put(objet(m));
            JSObject r = new JSObject();
            r.put("messages", messages);
            return r;
        });
    }

    private void executer(PluginCall call, Travail travail) {
        final Reglages reglages;
        try {
            Integer port = call.getInt("port");
            reglages = Reglages.valider(call.getString("hote"), port, call.getString("adresse"), call.getString("motDePasse"));
        } catch (IllegalArgumentException e) {
            call.reject(Reglages.INVALIDES);
            return;
        }
        fil.execute(() -> {
            Store store = null;
            Folder boite = null;
            try {
                Session session = Session.getInstance(reglages.proprietes());
                session.setDebug(false);
                store = session.getStore("imaps");
                store.connect(reglages.hote, reglages.port, reglages.adresse, reglages.motDePasse);
                boite = store.getFolder("INBOX");
                boite.open(Folder.READ_ONLY);
                call.resolve(travail.faire(boite));
            } catch (Throwable e) {
                call.reject(Erreurs.message(e));
            } finally {
                fermer(boite);
                fermer(store);
            }
        });
    }

    /** Fermeture sans effacement définitif (close(false)) ; erreurs ignorées. */
    private static void fermer(Folder f) {
        try {
            if (f != null && f.isOpen()) f.close(false);
        } catch (Exception ignore) {
            // déjà fermée
        }
    }

    private static void fermer(Store s) {
        try {
            if (s != null) s.close();
        } catch (Exception ignore) {
            // déjà fermé
        }
    }

    private static List<String> liste(PluginCall call, String cle) {
        List<String> r = new ArrayList<>();
        JSONArray a = call.getArray(cle, new JSArray());
        if (a == null) return r;
        for (int i = 0; i < a.length(); i++) {
            String s = a.optString(i, "");
            if (s != null && !s.trim().isEmpty()) r.add(s);
        }
        return r;
    }

    private static JSObject objet(Lecture.Courriel m) {
        JSObject o = new JSObject();
        o.put("id", m.id);
        o.put("date", m.date);
        o.put("expediteur", m.expediteur);
        o.put("sujet", m.sujet);
        o.put("texte", m.texte);
        JSArray pieces = new JSArray();
        for (Lecture.Piece p : m.pieces) {
            JSObject j = new JSObject();
            j.put("nom", p.nom);
            j.put("type", p.type);
            j.put("taille", p.taille);
            if (p.base64 != null) j.put("base64", p.base64);
            pieces.put(j);
        }
        o.put("pieces", pieces);
        return o;
    }

    @Override
    protected void handleOnDestroy() {
        fil.shutdownNow();
        super.handleOnDestroy();
    }
}

package app.klad.vault;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Cipher;

/**
 * Plugin local « KladVault » (écrit pour Klad, sans dépendance tierce de sécurité).
 *
 * Toutes les issues attendues sont « résolues » avec { ok: true, … } ou { ok: false, reason } :
 *   reason = "code" (code faux), "attente" (délai après des codes faux, waitMs), "annule", "invalidee"
 *            (empreinte invalidée), "casse" (coffre illisible), "erreur" (message).
 * La DEK n'est jamais gardée ici : elle est remise à l'appli (base64) puis effacée.
 */
@CapacitorPlugin(name = "KladVault")
public class KladVaultPlugin extends Plugin {

    private Vault vault;
    private Transfert transfert;
    private final ExecutorService fil = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        vault = new Vault(getContext());
        transfert = new Transfert(new File(getContext().getNoBackupFilesDir(), "klad/echanges"));
        fil.execute(() -> transfert.nettoyer(System.currentTimeMillis()));
    }

    // ------------------------------------------------------------ outils

    private static String b64(byte[] b) {
        return Base64.getEncoder().encodeToString(b);
    }

    private static JSObject ok() {
        JSObject r = new JSObject();
        r.put("ok", true);
        return r;
    }

    private static JSObject fail(String reason, String message) {
        JSObject r = new JSObject();
        r.put("ok", false);
        r.put("reason", reason);
        if (message != null) r.put("message", message);
        return r;
    }

    /** Message lisible même quand Android n'en donne pas (nom de l'erreur et de sa cause). */
    static String describe(Throwable e) {
        StringBuilder b = new StringBuilder();
        for (Throwable t = e; t != null && b.length() < 300; t = t.getCause()) {
            if (b.length() > 0) b.append(" ← ");
            b.append(t.getClass().getSimpleName());
            if (t.getMessage() != null) b.append(" : ").append(t.getMessage());
        }
        return b.toString();
    }

    private static JSObject withDek(byte[] dek) {
        JSObject r = ok();
        r.put("dek", b64(dek));
        Arrays.fill(dek, (byte) 0);
        return r;
    }

    private static JSObject attemptFail(Vault.Attempt a) {
        JSObject r = fail(a.reason, null);
        r.put("waitMs", a.waitMs);
        r.put("failures", a.failures);
        return r;
    }

    /** Code lu dans l'appel ; null (et appel rejeté) s'il n'a pas 6 chiffres. */
    private static char[] pin(PluginCall call, String key) {
        String s = call.getString(key);
        if (!Coffre.isPin(s)) {
            call.reject("Code attendu : 6 chiffres", "BAD_ARG");
            return null;
        }
        return s.toCharArray();
    }

    private boolean bioAvailable() {
        return BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    // ------------------------------------------------------------ état, création, code

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("exists", vault.exists());
        r.put("bio", vault.bioState());
        r.put("bioAvailable", bioAvailable());
        r.put("waitMs", vault.waitMs());
        r.put("failures", vault.failures());
        r.put("strongBox", vault.strongBox());
        call.resolve(r);
    }

    @PluginMethod
    public void create(PluginCall call) {
        char[] pin = pin(call, "pin");
        if (pin == null) return;
        try {
            call.resolve(withDek(vault.create(pin)));
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        } finally {
            Arrays.fill(pin, '\0');
        }
    }

    @PluginMethod
    public void unlockPin(PluginCall call) {
        char[] pin = pin(call, "pin");
        if (pin == null) return;
        try {
            Vault.Attempt a = vault.unlock(pin);
            call.resolve(a.dek != null ? withDek(a.dek) : attemptFail(a));
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        } finally {
            Arrays.fill(pin, '\0');
        }
    }

    @PluginMethod
    public void changePin(PluginCall call) {
        char[] old = pin(call, "old");
        if (old == null) return;
        char[] pin = pin(call, "pin");
        if (pin == null) return;
        byte[] dek = null;
        try {
            Vault.Attempt a = vault.unlock(old);
            if (a.dek == null) {
                call.resolve(attemptFail(a));
                return;
            }
            dek = a.dek;
            vault.rewrap(dek, pin);
            call.resolve(ok());
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        } finally {
            if (dek != null) Arrays.fill(dek, (byte) 0);
            Arrays.fill(old, '\0');
            Arrays.fill(pin, '\0');
        }
    }

    /** Effacement complet, demandé par l'utilisateur : le code est exigé. */
    @PluginMethod
    public void wipe(PluginCall call) {
        char[] pin = pin(call, "pin");
        if (pin == null) return;
        try {
            Vault.Attempt a = vault.unlock(pin);
            if (a.dek == null) {
                call.resolve(attemptFail(a));
                return;
            }
            Arrays.fill(a.dek, (byte) 0);
            vault.wipe();
            call.resolve(ok());
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        } finally {
            Arrays.fill(pin, '\0');
        }
    }

    // ------------------------------------------------------------ empreinte

    private interface OnCipher {
        void run(Cipher c) throws Exception;
    }

    /**
     * BiometricPrompt avec CryptoObject (fil principal). Une seule réponse par appel : une erreur intermédiaire
     * (visage non reconnu, par exemple) ne doit ni masquer ni doubler la réponse finale.
     */
    private void prompt(PluginCall call, Cipher cipher, String title, String negative, OnCipher done) {
        AtomicBoolean answered = new AtomicBoolean(false);
        getActivity().runOnUiThread(() -> {
            BiometricPrompt bp = new BiometricPrompt(
                getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        if (answered.getAndSet(true)) return;
                        BiometricPrompt.CryptoObject co = result.getCryptoObject();
                        try {
                            if (co == null || co.getCipher() == null) throw new IllegalStateException("Empreinte sans clé");
                            Cipher c = co.getCipher();
                            c.updateAAD(Coffre.AAD_BIO);   // seulement maintenant : la clé exige l'empreinte
                            done.run(c);
                        } catch (Exception e) {
                            call.resolve(fail("erreur", describe(e)));
                        }
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence msg) {
                        if (answered.getAndSet(true)) return;
                        boolean cancelled = code == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                            || code == BiometricPrompt.ERROR_USER_CANCELED
                            || code == BiometricPrompt.ERROR_CANCELED;
                        call.resolve(fail(cancelled ? "annule" : "erreur", msg == null ? "Empreinte : erreur " + code : msg.toString()));
                    }
                }
            );
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setNegativeButtonText(negative)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setConfirmationRequired(false)
                .build();
            bp.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
        });
    }

    @PluginMethod
    public void unlockBio(PluginCall call) {
        try {
            byte[] env = vault.bioEnvelope();
            if (env == null) {
                call.resolve(fail("invalidee".equals(vault.bioState()) ? "invalidee" : "absente", null));
                return;
            }
            Cipher c = vault.bioDecrypter();
            if (c == null) {
                call.resolve(fail("invalidee", null));
                return;
            }
            prompt(call, c, "Déverrouiller Klad", "Utiliser le code", cipher -> {
                byte[] dek = cipher.doFinal(env, Coffre.IV_BYTES, env.length - Coffre.IV_BYTES);
                vault.resetFailures();
                call.resolve(withDek(dek));
            });
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        }
    }

    @PluginMethod
    public void enableBio(PluginCall call) {
        if (!bioAvailable()) {
            call.resolve(fail("erreur", "Aucune empreinte forte disponible sur ce téléphone"));
            return;
        }
        char[] pin = pin(call, "pin");
        if (pin == null) return;
        byte[] dek;
        try {
            Vault.Attempt a = vault.unlock(pin);
            if (a.dek == null) {
                call.resolve(attemptFail(a));
                return;
            }
            dek = a.dek;
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
            return;
        } finally {
            Arrays.fill(pin, '\0');
        }
        final byte[] key = dek;
        try {
            Cipher c = vault.bioEncrypter();
            prompt(call, c, "Activer l'empreinte", "Annuler", cipher -> {
                try {
                    byte[] iv = cipher.getIV();
                    vault.saveBio(Coffre.join(iv, cipher.doFinal(key)));
                    call.resolve(ok());
                } finally {
                    Arrays.fill(key, (byte) 0);
                }
            });
        } catch (Exception e) {
            Arrays.fill(key, (byte) 0);
            call.resolve(fail("erreur", describe(e)));
        }
    }

    @PluginMethod
    public void disableBio(PluginCall call) {
        try {
            vault.disableBio();
            call.resolve(ok());
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        }
    }

    // ------------------------------------------------------------ blocs chiffrés

    @PluginMethod
    public void writeBlob(PluginCall call) {
        try {
            vault.writeBlob(call.getString("name"), Base64.getDecoder().decode(call.getString("data", "")));
            call.resolve(ok());
        } catch (Exception e) {
            call.reject("Écriture impossible : " + e.getMessage(), "IO");
        }
    }

    @PluginMethod
    public void readBlob(PluginCall call) {
        try {
            byte[] b = vault.readBlob(call.getString("name"));
            JSObject r = ok();
            r.put("data", b == null ? null : b64(b));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Lecture impossible : " + e.getMessage(), "IO");
        }
    }

    @PluginMethod
    public void deleteBlob(PluginCall call) {
        try {
            vault.deleteBlob(call.getString("name"));
            call.resolve(ok());
        } catch (Exception e) {
            call.reject("Suppression impossible : " + e.getMessage(), "IO");
        }
    }

    // ------------------------------------------------------------ fichiers par morceaux (1.0.1, voir Transfert)
    // Le sélecteur ne reçoit qu'un jeton : la demande gardée par Capacitor pendant le sélecteur reste minuscule.

    private static String jeton(PluginCall call) {
        String j = call.getString("jeton");
        if (!Transfert.jetonValide(j)) {
            call.reject("Jeton invalide", "BAD_ARG");
            return null;
        }
        return j;
    }

    @PluginMethod
    public void tmpOuvrir(PluginCall call) {
        try {
            JSObject r = ok();
            r.put("jeton", transfert.ouvrir());
            call.resolve(r);
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        }
    }

    @PluginMethod
    public void tmpAjouter(PluginCall call) {
        String j = jeton(call);
        if (j == null) return;
        try {
            JSObject r = ok();
            r.put("taille", transfert.ajouter(j, Base64.getDecoder().decode(call.getString("data", ""))));
            call.resolve(r);
        } catch (Exception e) {
            transfert.abandonner(j);
            call.resolve(fail("erreur", describe(e)));
        }
    }

    @PluginMethod
    public void tmpLire(PluginCall call) {
        String j = jeton(call);
        if (j == null) return;
        try {
            // optLong : un petit nombre arrive en Integer, que PluginCall.getLong ignorerait (valeur par défaut)
            long debut = call.getData().optLong("debut", 0L);
            int longueur = call.getInt("longueur", Transfert.MAX_MORCEAU);
            byte[] b = transfert.lire(j, debut, longueur);
            JSObject r = ok();
            r.put("data", b64(b));
            r.put("fin", debut + b.length >= transfert.taille(j));
            call.resolve(r);
        } catch (Exception e) {
            call.resolve(fail("erreur", describe(e)));
        }
    }

    @PluginMethod
    public void tmpAbandon(PluginCall call) {
        String j = jeton(call);
        if (j == null) return;
        transfert.abandonner(j);
        call.resolve(ok());
    }

    /** Fichier choisi par le sélecteur, ouvert par le ContentResolver. */
    private Transfert.Destination destination(final Uri uri) {
        final ContentResolver cr = getContext().getContentResolver();
        return new Transfert.Destination() {
            @Override
            public OutputStream ouvrir() throws IOException {
                // « wt » (écriture, contenu tronqué) ; repli sur « w » pour un fournisseur qui refuse ce mode
                try {
                    return cr.openOutputStream(uri, "wt");
                } catch (IllegalArgumentException | UnsupportedOperationException | java.io.FileNotFoundException e) {
                    return cr.openOutputStream(uri, "w");
                }
            }

            @Override
            public InputStream relire() throws IOException {
                return cr.openInputStream(uri);
            }

            @Override
            public boolean supprimer() {
                try {
                    return DocumentsContract.deleteDocument(cr, uri);
                } catch (Exception e) {
                    return false;
                }
            }
        };
    }

    /**
     * Enregistre le fichier temporaire « jeton » à l'endroit choisi (sélecteur Android, Drive compris).
     * { jeton, name, type ("application/json" ou binaire), nature ("sauvegarde", "controle"…) } → { ok, taille } ou
     * { ok: false, reason: "annule" | "erreur", message }. Le résultat est aussi gardé (resultatEnregistrement).
     */
    @PluginMethod
    public void enregistrerFichier(PluginCall call) {
        String j = jeton(call);
        if (j == null) return;
        if (!transfert.fichier(j).isFile()) {
            call.resolve(fail("erreur", "Fichier préparé introuvable"));
            return;
        }
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/json".equals(call.getString("type", "")) ? "application/json" : "application/octet-stream");
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "klad-sauvegarde.klad"));
        startActivityForResult(call, i, "enregistre");
    }

    // Appelé aussi après une recréation de l'activité (demande « orpheline » rendue par Capacitor) : le fichier
    // temporaire est sur disque, la copie se fait et le résultat est gardé pour l'appli.
    @ActivityCallback
    private void enregistre(PluginCall call, ActivityResult res) {
        if (call == null) return;
        final String j = call.getString("jeton");
        final String nature = call.getString("nature", "");
        final Uri uri = res.getResultCode() == Activity.RESULT_OK && res.getData() != null ? res.getData().getData() : null;
        if (uri == null || !Transfert.jetonValide(j)) {
            Transfert.Resultat r = Transfert.Resultat.echec("annule", null);
            if (Transfert.jetonValide(j)) {
                transfert.abandonner(j);
                transfert.noter(j, nature, r, System.currentTimeMillis());
            }
            call.resolve(fail("annule", null));
            return;
        }
        // copie hors du fil principal : un gros fichier vers Drive ne doit pas figer l'appli
        fil.execute(() -> {
            Transfert.Resultat r = transfert.enregistrer(j, destination(uri));
            transfert.noter(j, nature, r, System.currentTimeMillis());
            if (r.ok) {
                JSObject o = ok();
                o.put("taille", r.taille);
                call.resolve(o);
            } else call.resolve(fail(r.raison, r.message));
        });
    }

    /** Dernier résultat d'enregistrement gardé → { resultat: { jeton, nature, ok, reason, message, taille, le } | null }. */
    @PluginMethod
    public void resultatEnregistrement(PluginCall call) {
        java.util.Properties p = transfert.dernier();
        JSObject r = ok();
        if (p != null) {
            JSObject o = new JSObject();
            o.put("jeton", p.getProperty("jeton", ""));
            o.put("nature", p.getProperty("nature", ""));
            o.put("ok", "1".equals(p.getProperty("ok")));
            o.put("reason", p.getProperty("raison", ""));
            o.put("message", p.getProperty("message", ""));
            o.put("taille", Long.parseLong(p.getProperty("taille", "0")));
            o.put("le", Long.parseLong(p.getProperty("le", "0")));
            r.put("resultat", o);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void oublierEnregistrement(PluginCall call) {
        transfert.oublier(call.getString("jeton"));
        call.resolve(ok());
    }

    /** Sélecteur Android → fichier copié dans un fichier temporaire, lu ensuite par morceaux (tmpLire) → { jeton, taille }. */
    @PluginMethod
    public void choisirFichier(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        // Type facultatif (« application/pdf » pour un bulletin ou un avis) ; le sélecteur Android propose aussi Drive.
        String type = call.getString("type", "*/*");
        i.setType("application/pdf".equals(type) ? type : "*/*");
        startActivityForResult(call, i, "choisi");
    }

    @ActivityCallback
    private void choisi(PluginCall call, ActivityResult res) {
        if (call == null) return;
        final Uri uri = res.getResultCode() == Activity.RESULT_OK && res.getData() != null ? res.getData().getData() : null;
        if (uri == null) {
            call.resolve(fail("annule", null));
            return;
        }
        fil.execute(() -> {
            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IOException("Fichier inaccessible");
                String j = transfert.recevoir(in);
                JSObject r = ok();
                r.put("jeton", j);
                r.put("taille", transfert.taille(j));
                call.resolve(r);
            } catch (Exception e) {
                call.resolve(fail("erreur", describe(e)));
            }
        });
    }
}

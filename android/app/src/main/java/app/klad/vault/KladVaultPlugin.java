package app.klad.vault;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Base64;
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

    private static final int MAX_IMPORT = 50 * 1024 * 1024;

    private Vault vault;

    @Override
    public void load() {
        vault = new Vault(getContext());
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
            call.resolve(fail("erreur", e.getMessage()));
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
            call.resolve(fail("erreur", e.getMessage()));
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
            call.resolve(fail("erreur", e.getMessage()));
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
            call.resolve(fail("erreur", e.getMessage()));
        } finally {
            Arrays.fill(pin, '\0');
        }
    }

    // ------------------------------------------------------------ empreinte

    private interface OnCipher {
        void run(Cipher c) throws Exception;
    }

    /** BiometricPrompt avec CryptoObject (fil principal). */
    private void prompt(PluginCall call, Cipher cipher, String title, String negative, OnCipher done) {
        getActivity().runOnUiThread(() -> {
            BiometricPrompt bp = new BiometricPrompt(
                getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        BiometricPrompt.CryptoObject co = result.getCryptoObject();
                        try {
                            if (co == null || co.getCipher() == null) throw new IllegalStateException("Empreinte sans clé");
                            done.run(co.getCipher());
                        } catch (Exception e) {
                            call.resolve(fail("erreur", e.getMessage()));
                        }
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence msg) {
                        boolean cancelled = code == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                            || code == BiometricPrompt.ERROR_USER_CANCELED
                            || code == BiometricPrompt.ERROR_CANCELED;
                        call.resolve(fail(cancelled ? "annule" : "erreur", msg == null ? null : msg.toString()));
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
            call.resolve(fail("erreur", e.getMessage()));
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
            call.resolve(fail("erreur", e.getMessage()));
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
            call.resolve(fail("erreur", e.getMessage()));
        }
    }

    @PluginMethod
    public void disableBio(PluginCall call) {
        try {
            vault.disableBio();
            call.resolve(ok());
        } catch (Exception e) {
            call.resolve(fail("erreur", e.getMessage()));
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

    // ------------------------------------------------------------ sauvegarde : sélecteur de fichiers Android

    @PluginMethod
    public void exportFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/octet-stream");
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "klad-sauvegarde.klad"));
        startActivityForResult(call, i, "exportDone");
    }

    @ActivityCallback
    private void exportDone(PluginCall call, ActivityResult res) {
        if (call == null) return;
        Uri uri = res.getResultCode() == Activity.RESULT_OK && res.getData() != null ? res.getData().getData() : null;
        if (uri == null) {
            call.resolve(fail("annule", null));
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("Fichier inaccessible");
            out.write(Base64.getDecoder().decode(call.getString("data", "")));
            call.resolve(ok());
        } catch (Exception e) {
            call.resolve(fail("erreur", e.getMessage()));
        }
    }

    @PluginMethod
    public void importFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(call, i, "importDone");
    }

    @ActivityCallback
    private void importDone(PluginCall call, ActivityResult res) {
        if (call == null) return;
        Uri uri = res.getResultCode() == Activity.RESULT_OK && res.getData() != null ? res.getData().getData() : null;
        if (uri == null) {
            call.resolve(fail("annule", null));
            return;
        }
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("Fichier inaccessible");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > MAX_IMPORT) throw new IOException("Fichier trop gros");
            }
            JSObject r = ok();
            r.put("data", b64(buf.toByteArray()));
            call.resolve(r);
        } catch (Exception e) {
            call.resolve(fail("erreur", e.getMessage()));
        }
    }
}

package app.klad.update;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Plugin local « KladUpdate » : mise à jour de Klad depuis ses publications GitHub.
 *
 * 1. download : télécharge l'APK (https://github.com/…/releases/download/…) dans le cache de l'appli,
 *    vérifie son empreinte SHA-256 (publiée par GitHub) puis l'APK lui-même : même identifiant d'appli,
 *    version plus récente, même certificat de signature.
 * 2. install : confie l'APK au service d'installation d'Android (PackageInstaller), qui demande confirmation.
 *    Android refuse de toute façon une mise à jour signée par une autre clé ; les données sont conservées.
 *
 * Issues attendues résolues avec { ok: true, … } ou { ok: false, reason, message } :
 *   reason = "adresse", "empreinte", "apk", "version", "signature", "autorisation", "reseau", "erreur".
 */
@CapacitorPlugin(name = "KladUpdate")
public class KladUpdatePlugin extends Plugin {

    private static final String ACTION_STATUS = "app.klad.update.STATUT";

    private BroadcastReceiver statusReceiver;

    private File apkFile() {
        return new File(new File(getContext().getCacheDir(), "maj"), "klad.apk");
    }

    @Override
    public void load() {
        deleteApk();                         // reste d'une mise à jour précédente
        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                onStatus(intent);
            }
        };
        ContextCompat.registerReceiver(getContext(), statusReceiver, new IntentFilter(ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(statusReceiver);
        } catch (IllegalArgumentException ignored) {
            // déjà retiré
        }
    }

    private void deleteApk() {
        File f = apkFile();
        if (f.exists()) f.delete();
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
        r.put("message", message);
        return r;
    }

    private PackageInfo self() throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
    }

    private static long versionCode(PackageInfo p) {
        return p.getLongVersionCode();
    }

    // ------------------------------------------------------------ état

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = ok();
        try {
            PackageInfo p = self();
            r.put("versionName", p.versionName);
            r.put("versionCode", versionCode(p));
        } catch (PackageManager.NameNotFoundException e) {
            r.put("versionName", null);
        }
        r.put("canInstall", getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    /** Réglage Android « Installer des applis inconnues » pour Klad. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve(ok());
    }

    // ------------------------------------------------------------ téléchargement et vérifications

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String digest = call.getString("sha256");
        if (!Maj.allowedUrl(url)) {
            call.resolve(fail("adresse", "Adresse de téléchargement refusée"));
            return;
        }
        if (Maj.expectedSha256(digest) == null) {
            call.resolve(fail("empreinte", "Empreinte SHA-256 de la publication absente"));
            return;
        }
        // Fil dédié : le téléchargement ne bloque pas les autres appels (coffre).
        new Thread(() -> {
            try {
                call.resolve(fetchAndCheck(url, digest));
            } catch (IOException e) {
                deleteApk();
                call.resolve(fail("reseau", describe(e)));
            } catch (Exception e) {
                deleteApk();
                call.resolve(fail("erreur", describe(e)));
            }
        }, "klad-maj").start();
    }

    private JSObject fetchAndCheck(String url, String digest) throws Exception {
        File f = apkFile();
        File dir = f.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new IOException("Dossier de téléchargement impossible à créer");
        MessageDigest sha = MessageDigest.getInstance("SHA-256");

        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);  // github.com → serveur de fichiers de GitHub (HTTPS → HTTPS)
        c.setConnectTimeout(20_000);
        c.setReadTimeout(30_000);
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new IOException("Téléchargement refusé (HTTP " + code + ")");
            if (!"https".equals(c.getURL().getProtocol())) throw new IOException("Redirection non chiffrée refusée");
            long total = c.getContentLengthLong();
            if (total > Maj.MAX_BYTES) throw new IOException("Fichier trop gros");
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                byte[] buf = new byte[64 * 1024];
                long got = 0;
                int lastPct = -1;
                int n;
                while ((n = in.read(buf)) > 0) {
                    got += n;
                    if (got > Maj.MAX_BYTES) throw new IOException("Fichier trop gros");
                    sha.update(buf, 0, n);
                    out.write(buf, 0, n);
                    int pct = total > 0 ? (int) (got * 100 / total) : -1;
                    if (pct != lastPct && (pct < 0 ? got % (1024 * 1024) < n : pct % 5 == 0)) {
                        lastPct = pct;
                        JSObject p = new JSObject();
                        p.put("received", got);
                        p.put("total", total);
                        notifyListeners("progress", p);
                    }
                }
            }
        } finally {
            c.disconnect();
        }

        if (!Maj.sameDigest(digest, sha.digest())) {
            deleteApk();
            return fail("empreinte", "Le fichier téléchargé ne correspond pas à l'empreinte publiée");
        }

        PackageManager pm = getContext().getPackageManager();
        PackageInfo apk = pm.getPackageArchiveInfo(f.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        PackageInfo me = self();
        if (apk == null) {
            deleteApk();
            return fail("apk", "Fichier APK illisible");
        }
        if (!getContext().getPackageName().equals(apk.packageName)) {
            deleteApk();
            return fail("apk", "Cet APK n'est pas Klad (identifiant d'appli différent)");
        }
        if (versionCode(apk) <= versionCode(me)) {
            deleteApk();
            return fail("version", "Cette version n'est pas plus récente que celle installée");
        }
        // Contrôle anticipé de la signature. S'il ne peut pas être lu, Android le fait de toute façon à l'installation.
        Set<String> mine = signers(me.signingInfo);
        Set<String> theirs = signers(apk.signingInfo);
        if (!mine.isEmpty() && !theirs.isEmpty() && !mine.equals(theirs)) {
            deleteApk();
            return fail("signature", "APK signé par une autre clé : mise à jour refusée");
        }
        JSObject r = ok();
        r.put("versionName", apk.versionName);
        r.put("versionCode", versionCode(apk));
        r.put("signatureChecked", !theirs.isEmpty());
        return r;
    }

    private static Set<String> signers(SigningInfo si) {
        Set<String> s = new HashSet<>();
        if (si == null) return s;
        Signature[] sigs = si.hasMultipleSigners() ? si.getApkContentsSigners() : si.getSigningCertificateHistory();
        if (sigs == null) return s;
        if (!si.hasMultipleSigners() && sigs.length > 0) sigs = Arrays.copyOfRange(sigs, sigs.length - 1, sigs.length); // certificat actuel
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (Signature g : sigs) s.add(Maj.hex(md.digest(g.toByteArray())));
        } catch (Exception ignored) {
            s.clear();
        }
        return s;
    }

    // ------------------------------------------------------------ installation

    @PluginMethod
    public void install(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        if (!pm.canRequestPackageInstalls()) {
            call.resolve(fail("autorisation", "Autorisez Klad à installer des applis"));
            return;
        }
        File f = apkFile();
        if (!f.exists()) {
            call.resolve(fail("apk", "Aucune mise à jour téléchargée"));
            return;
        }
        PackageInstaller.Session session = null;
        try {
            PackageInstaller pi = pm.getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(getContext().getPackageName());
            params.setSize(f.length());
            int id = pi.createSession(params);
            session = pi.openSession(id);
            try (InputStream in = new FileInputStream(f); OutputStream out = session.openWrite("klad.apk", 0, f.length())) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                session.fsync(out);
            }
            Intent status = new Intent(ACTION_STATUS).setPackage(getContext().getPackageName());
            PendingIntent pending = PendingIntent.getBroadcast(getContext(), id, status,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            session.commit(pending.getIntentSender());
            session.close();
            session = null;
            call.resolve(ok());
        } catch (Exception e) {
            if (session != null) session.abandon();
            call.resolve(fail("erreur", describe(e)));
        }
    }

    /** Réponse du service d'installation : confirmation à demander, ou échec à signaler à l'appli. */
    @SuppressWarnings("deprecation")
    private void onStatus(Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(confirm);
            }
            return;
        }
        if (status != PackageInstaller.STATUS_SUCCESS) deleteApk();
        JSObject r = new JSObject();
        r.put("ok", status == PackageInstaller.STATUS_SUCCESS);
        r.put("status", status);
        r.put("message", intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
        notifyListeners("installStatus", r);
    }

    private static String describe(Throwable e) {
        StringBuilder b = new StringBuilder();
        for (Throwable t = e; t != null && b.length() < 300; t = t.getCause()) {
            if (b.length() > 0) b.append(" ← ");
            b.append(t.getClass().getSimpleName());
            if (t.getMessage() != null) b.append(" : ").append(t.getMessage());
        }
        return b.toString();
    }
}

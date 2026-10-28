package app.klad.grafit;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Binder;
import java.io.File;
import java.util.List;

/**
 * Lecture seule du résumé par Grafit : content://<identifiant d'appli>.grafit/summary.
 *
 * - Exporté sans permission de lecture (Grafit est une autre appli), grantUriPermissions="false".
 * - Contrôle de l'appelant au début de query() : UID de Grafit, signé par le certificat attendu ; sinon SecurityException.
 * - Aucun calcul, aucun réseau, aucune synchro : relit le dernier résumé chiffré enregistré par l'appli (KladGrafit),
 *   lisible même appli verrouillée (clé Keystore sans authentification). Sans résumé : {"v":1,"state":"empty"}.
 * - insert, update, delete : UnsupportedOperationException.
 */
public class GrafitProvider extends ContentProvider {

    private Stockage stockage;

    /** Dossier du résumé (sans sauvegarde Android). */
    static File dossier(Context ctx) {
        return new File(ctx.getNoBackupFilesDir(), "klad");
    }

    static Stockage stockage(Context ctx) {
        return new Stockage(dossier(ctx), new CleKeystore());
    }

    /** content://<authority>/summary */
    public static Uri uri(Context ctx) {
        return new Uri.Builder().scheme("content").authority(GrafitConfig.authority(ctx.getPackageName()))
            .appendPath(GrafitConfig.CHEMIN).build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    private synchronized Stockage stockage() {
        if (stockage == null) stockage = stockage(getContext());
        return stockage;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        // Contrôle obligatoire, avant toute autre chose : l'UID appelant, jamais getCallingPackage().
        Appelant.verifier(Binder.getCallingUid(), new PaquetsAndroid(getContext().getPackageManager()));
        Context ctx = getContext();
        List<String> seg = uri == null ? null : uri.getPathSegments();
        if (uri == null || !GrafitConfig.authority(ctx.getPackageName()).equals(uri.getAuthority())
            || seg == null || seg.size() != 1 || !GrafitConfig.CHEMIN.equals(seg.get(0))) {
            throw new IllegalArgumentException("Adresse inconnue");
        }
        String[] cols = Resume.colonnes(projection);
        MatrixCursor c = new MatrixCursor(cols, 1);
        c.addRow(Resume.ligne(cols, stockage().lire()));
        c.setNotificationUri(ctx.getContentResolver(), uri(ctx));
        return c;
    }

    @Override
    public String getType(Uri uri) {
        return "vnd.android.cursor.item/vnd.klad.summary";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Lecture seule");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Lecture seule");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Lecture seule");
    }

    /** Appelant.Paquets sur le vrai PackageManager. */
    static final class PaquetsAndroid implements Appelant.Paquets {
        private final PackageManager pm;

        PaquetsAndroid(PackageManager pm) {
            this.pm = pm;
        }

        @Override
        public String[] pourUid(int uid) {
            return pm.getPackagesForUid(uid);
        }

        @Override
        public boolean signePar(String paquet, byte[] sha256) {
            return pm.hasSigningCertificate(paquet, sha256, PackageManager.CERT_INPUT_SHA256);
        }
    }
}

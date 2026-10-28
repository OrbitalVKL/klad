package app.klad.grafit;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.ProviderException;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/**
 * Clé Android Keystore « klad.resume » : AES-256-GCM, non exportable, SANS authentification (le résumé doit rester
 * lisible appli verrouillée), StrongBox si le téléphone en a. Créée à la première écriture du résumé ;
 * supprimée par « Tout effacer » (Vault.wipe).
 */
final class CleKeystore implements Stockage.Cles {

    static final String ALIAS = "klad.resume";
    private static final String KS = "AndroidKeyStore";

    @Override
    public synchronized SecretKey cle(boolean creer) throws GeneralSecurityException, IOException {
        SecretKey k = lire();
        if (k != null || !creer) return k;
        try {
            generer(true);
        } catch (ProviderException e) {           // StrongBox absent ou refusant ces réglages
            generer(false);
        }
        return lire();
    }

    private static SecretKey lire() throws GeneralSecurityException, IOException {
        KeyStore ks = KeyStore.getInstance(KS);
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(ALIAS, null);
        return e instanceof KeyStore.SecretKeyEntry ? ((KeyStore.SecretKeyEntry) e).getSecretKey() : null;
    }

    private static void generer(boolean strongBox) throws GeneralSecurityException {
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KS);
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setIsStrongBoxBacked(strongBox)
            .build());
        g.generateKey();
    }
}

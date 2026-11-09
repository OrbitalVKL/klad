package app.klad.vault;

import android.content.Context;
import java.io.IOException;

/**
 * Accès au coffre pour la synchro planifiée (2.3.0, app.klad.fond) : DEK de l'enveloppe « arrière-plan », blocs
 * chiffrés. Les blocs restent chiffrés par l'appli (WebCrypto) : ce pont ne fait que les lire et les écrire.
 */
public final class CoffreFond {

    private final Vault vault;

    public CoffreFond(Context ctx) {
        vault = Vault.get(ctx);
    }

    public boolean existe() {
        return vault.exists();
    }

    public boolean actif() {
        return vault.fondActif();
    }

    public boolean strongBox() {
        return vault.strongBox();
    }

    /** DEK (32 octets, à effacer après usage) ou null. */
    public byte[] dek() {
        return vault.dekFond();
    }

    public byte[] lire(String nom) throws IOException {
        return vault.readBlob(nom);
    }

    public void ecrire(String nom, byte[] data) throws IOException {
        vault.writeBlob(nom, data);
    }

    public void effacer(String nom) {
        vault.deleteBlob(nom);
    }
}

package app.klad.grafit;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.GeneralSecurityException;
import javax.crypto.SecretKey;

/**
 * Fichier du résumé chiffré (noBackupFilesDir/klad/resume.bin), sans Android : testé par JUnit avec une clé logicielle.
 * Écriture atomique (fichier temporaire, puis renommage) : un lecteur voit l'ancien résumé ou le nouveau, jamais un mélange.
 * Lecture : null si rien n'est enregistré, si la clé n'existe pas, ou si le fichier est illisible (jamais d'exception).
 */
public final class Stockage {

    /** Source de la clé « klad.resume » : Keystore sur le téléphone, clé logicielle dans les tests. */
    public interface Cles {
        /** Clé du résumé ; si creer est faux et qu'elle n'existe pas encore, null. */
        SecretKey cle(boolean creer) throws GeneralSecurityException, IOException;
    }

    static final String NOM = "resume.bin";

    private final File dir;
    private final File fichier;
    private final Cles cles;

    public Stockage(File dir, Cles cles) {
        this.dir = dir;
        this.fichier = new File(dir, NOM);
        this.cles = cles;
    }

    /** Chiffre et enregistre le résumé. IllegalArgumentException si le JSON est refusé (taille, forme). */
    public synchronized void ecrire(String json, long misAJour) throws GeneralSecurityException, IOException {
        Resume.valider(json);
        SecretKey k = cles.cle(true);
        if (k == null) throw new GeneralSecurityException("Clé du résumé indisponible");
        byte[] b = Resume.sceller(k, misAJour, json, null);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Dossier du résumé impossible à créer");
        File tmp = new File(dir, NOM + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(b);
            out.getFD().sync();
        }
        try {
            Files.move(tmp.toPath(), fichier.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            if (!tmp.delete()) tmp.deleteOnExit();
            throw e;
        }
    }

    /** Dernier résumé enregistré, ou null. */
    public Resume.Lu lire() {
        try {
            if (!fichier.isFile()) return null;
            SecretKey k = cles.cle(false);
            if (k == null) return null;
            return Resume.ouvrir(k, Files.readAllBytes(fichier.toPath()));
        } catch (Exception e) {
            return null;
        }
    }

    /** Supprime le résumé. true s'il existait. */
    public synchronized boolean effacer() {
        new File(dir, NOM + ".tmp").delete();
        return fichier.delete();
    }
}

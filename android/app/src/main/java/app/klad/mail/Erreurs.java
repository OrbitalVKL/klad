package app.klad.mail;

import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.MessagingException;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.security.cert.CertificateException;
import java.util.ArrayList;
import java.util.List;
import javax.net.ssl.SSLException;

/**
 * Message d'erreur montré à l'utilisateur. Toujours une phrase fixe : jamais le texte de l'exception (qui peut citer
 * l'adresse, le serveur ou la réponse du serveur), jamais le mot de passe. Logique pure, testée par JUnit.
 */
final class Erreurs {

    static final String IDENTIFIANTS = "Identifiants refusés (mot de passe d'application ?)";
    static final String INJOIGNABLE = "Serveur injoignable";
    static final String DELAI = "Délai dépassé";
    static final String CHIFFREMENT = "Connexion chiffrée impossible (certificat refusé ?)";
    static final String INVALIDES = Reglages.INVALIDES;
    static final String AUTRE = "Lecture de la boîte impossible";

    private Erreurs() {}

    static String message(Throwable e) {
        List<Throwable> chaine = chaine(e);
        for (Throwable t : chaine) if (t instanceof AuthenticationFailedException) return IDENTIFIANTS;
        for (Throwable t : chaine) if (t instanceof SocketTimeoutException) return DELAI;
        for (Throwable t : chaine) if (t instanceof SSLException || t instanceof CertificateException) return CHIFFREMENT;
        for (Throwable t : chaine) {
            if (t instanceof UnknownHostException || t instanceof ConnectException || t instanceof NoRouteToHostException) return INJOIGNABLE;
        }
        for (Throwable t : chaine) {
            if (t instanceof IllegalArgumentException && INVALIDES.equals(t.getMessage())) return INVALIDES;
        }
        return AUTRE;
    }

    /** L'exception, ses causes et les exceptions suivantes de MessagingException (20 au plus, sans boucle). */
    private static List<Throwable> chaine(Throwable e) {
        List<Throwable> l = new ArrayList<>();
        List<Throwable> aVoir = new ArrayList<>();
        if (e != null) aVoir.add(e);
        while (!aVoir.isEmpty() && l.size() < 20) {
            Throwable t = aVoir.remove(0);
            if (t == null || l.contains(t)) continue;
            l.add(t);
            if (t instanceof MessagingException) aVoir.add(((MessagingException) t).getNextException());
            aVoir.add(t.getCause());
        }
        return l;
    }
}

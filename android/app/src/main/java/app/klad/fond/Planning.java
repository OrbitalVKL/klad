package app.klad.fond;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Heures de la synchro planifiée (2.3.0) : 8 h et 14 h, heure du téléphone. Sans Android (testé par JUnit). */
public final class Planning {

    public static final int[] HEURES = {8, 14};
    /** Un passage prévu à moins d'une minute est sauté (évite deux synchros de suite). */
    static final long MARGE_MS = 60_000;

    private Planning() {}

    /** Prochain passage (ms) strictement après now + 1 min, dans le fuseau donné. */
    public static long prochain(long now, ZoneId zone) {
        LocalDate j = Instant.ofEpochMilli(now).atZone(zone).toLocalDate();
        for (int d = 0; d < 3; d++) {
            for (int h : HEURES) {
                ZonedDateTime t = ZonedDateTime.of(j.plusDays(d), LocalTime.of(h, 0), zone);
                long ms = t.toInstant().toEpochMilli();
                if (ms > now + MARGE_MS) return ms;
            }
        }
        throw new IllegalStateException("Aucun passage trouvé");
    }

    /**
     * 2.4.2 : heure à reprendre quand le réveil est reposé (déverrouillage, démarrage du téléphone) : celle déjà
     * prévue si elle est encore à venir (report de 30 min, essai dans 1 min), sinon le prochain 8 h / 14 h.
     */
    /** 2.4.4 : nouvel essai après un passage sans réseau : 30 min plus tard, ou le prochain 8 h / 14 h s'il vient avant. */
    public static long apresReseau(long now, ZoneId zone) {
        long creneau = prochain(now, zone);
        long essai = now + 30 * 60_000L;
        return essai + MARGE_MS < creneau ? essai : creneau;
    }

    /** 2.4.2 : voir reprendre(). */
    public static long reprendre(long prevu, long now, ZoneId zone) {
        return prevu > now + MARGE_MS ? prevu : prochain(now, zone);
    }
}

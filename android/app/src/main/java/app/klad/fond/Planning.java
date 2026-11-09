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
}

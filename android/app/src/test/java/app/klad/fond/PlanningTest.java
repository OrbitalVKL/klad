package app.klad.fond;

import static org.junit.Assert.assertEquals;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.Test;

public class PlanningTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    private static long t(String iso) {
        return ZonedDateTime.parse(iso).toInstant().toEpochMilli();
    }

    @Test
    public void prochainPassage() {
        assertEquals(t("2026-11-10T08:00+01:00[Europe/Paris]"), Planning.prochain(t("2026-11-09T22:00+01:00[Europe/Paris]"), PARIS));
        assertEquals(t("2026-11-09T08:00+01:00[Europe/Paris]"), Planning.prochain(t("2026-11-09T06:30+01:00[Europe/Paris]"), PARIS));
        assertEquals(t("2026-11-09T14:00+01:00[Europe/Paris]"), Planning.prochain(t("2026-11-09T08:00+01:00[Europe/Paris]"), PARIS));
        assertEquals(t("2026-11-09T14:00+01:00[Europe/Paris]"), Planning.prochain(t("2026-11-09T09:15+01:00[Europe/Paris]"), PARIS));
    }

    @Test
    public void passageTropProcheSaute() {
        // 13 h 59 min 30 s : le passage de 14 h est à moins d'une minute, le suivant est le lendemain 8 h
        assertEquals(t("2026-11-10T08:00+01:00[Europe/Paris]"), Planning.prochain(t("2026-11-09T13:59:30+01:00[Europe/Paris]"), PARIS));
    }

    @Test
    public void changementHeure() {
        // passage à l'heure d'été (29/03/2026) : 8 h reste 8 h, heure locale
        assertEquals(t("2026-03-29T08:00+02:00[Europe/Paris]"), Planning.prochain(t("2026-03-29T01:00+01:00[Europe/Paris]"), PARIS));
    }
}

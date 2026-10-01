import { describe, expect, test } from "vitest";
import { calcularVentana } from "./ventana-evento";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";
const MADRID = "Europe/Madrid";

describe("ventana de activación del evento", () => {
  test("un evento que arranca a las 20:00 cierra a las 08:00 del día siguiente", () => {
    const v = calcularVentana({
      fechaHoraLocal: "2026-10-10T20:00",
      zonaHoraria: BUENOS_AIRES,
    });

    expect(v.desactivacionLocal.hora).toBe("08:00");
    expect(v.desactivacionLocal.fecha).toBe("2026-10-11");
    expect(v.desactivacionLocal.esDiaSiguiente).toBe(true);
  });

  test("un evento de mañana cierra el mismo día", () => {
    const v = calcularVentana({
      fechaHoraLocal: "2026-10-10T09:00",
      zonaHoraria: BUENOS_AIRES,
    });

    expect(v.desactivacionLocal.hora).toBe("21:00");
    expect(v.desactivacionLocal.esDiaSiguiente).toBe(false);
  });

  test("la hora local elegida es la que efectivamente arranca", () => {
    const v = calcularVentana({
      fechaHoraLocal: "2026-10-10T20:00",
      zonaHoraria: BUENOS_AIRES,
    });

    // Buenos Aires es UTC-3 todo el año: las 20:00 de allá son las 23:00 UTC.
    expect(v.activacionUtc.toISOString()).toBe("2026-10-10T23:00:00.000Z");
  });

  test("cuando el reloj se adelanta, el evento igual dura 12 horas reales", () => {
    // En Madrid, el 29/03/2026 a las 02:00 los relojes saltan a las 03:00.
    // Un evento que arranca a las 20:00 del 28 cierra a las 09:00, no a las 08:00:
    // pasaron 12 horas de verdad, aunque el reloj muestre 13.
    const v = calcularVentana({
      fechaHoraLocal: "2026-03-28T20:00",
      zonaHoraria: MADRID,
    });

    expect(v.desactivacionLocal.hora).toBe("09:00");
    expect(v.desactivacionUtc.getTime() - v.activacionUtc.getTime()).toBe(12 * 3_600_000);
  });

  test("cuando el reloj se atrasa, el evento igual dura 12 horas reales", () => {
    // El 25/10/2026 en Madrid las 03:00 vuelven a ser las 02:00, así que el reloj marca
    // 07:00 cuando ya pasaron 12 horas de verdad. Una hora MENOS, no una más.
    const v = calcularVentana({
      fechaHoraLocal: "2026-10-24T20:00",
      zonaHoraria: MADRID,
    });

    expect(v.desactivacionLocal.hora).toBe("07:00");
    expect(v.desactivacionUtc.getTime() - v.activacionUtc.getTime()).toBe(12 * 3_600_000);
  });

  test("la duración se puede cambiar", () => {
    const v = calcularVentana({
      fechaHoraLocal: "2026-10-10T20:00",
      zonaHoraria: BUENOS_AIRES,
      horas: 6,
    });

    expect(v.desactivacionLocal.hora).toBe("02:00");
    expect(v.desactivacionLocal.esDiaSiguiente).toBe(true);
  });

  test("una fecha mal escrita se rechaza en vez de inventar una hora", () => {
    expect(() =>
      calcularVentana({ fechaHoraLocal: "10/10/2026 20:00", zonaHoraria: BUENOS_AIRES }),
    ).toThrow(/inválidas/);
  });

  test("una ventana de cero horas se rechaza", () => {
    expect(() =>
      calcularVentana({ fechaHoraLocal: "2026-10-10T20:00", zonaHoraria: BUENOS_AIRES, horas: 0 }),
    ).toThrow(/más de cero/);
  });
});

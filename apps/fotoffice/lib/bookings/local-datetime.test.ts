import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE, localMoment } from "./time";
import { parseLocalDateTime } from "./local-datetime";

const tz = BOOKINGS_TIME_ZONE;

describe("lo que escribe el equipo es lo que se guarda", () => {
  it("las 14:00 escritas son las 14:00 de Rosario, no del servidor", () => {
    const instante = parseLocalDateTime("2026-09-19T14:00", tz)!;
    // Argentina es UTC-3: las 14 locales son las 17Z.
    expect(instante.toISOString()).toBe("2026-09-19T17:00:00.000Z");
  });

  it("lo que se guarda se vuelve a leer igual en hora local", () => {
    // Es la propiedad que importa: escribir 14:00 y que la agenda muestre 14:00.
    for (const texto of [
      "2026-09-19T09:00",
      "2026-09-19T14:30",
      "2026-01-15T23:45",
      "2026-07-01T00:00",
    ]) {
      const instante = parseLocalDateTime(texto, tz)!;
      const m = localMoment(instante, tz);
      const [fecha, hora] = texto.split("T");
      expect(m.ymd, texto).toBe(fecha);
      expect(`${String(Math.floor(m.minuteOfDay / 60)).padStart(2, "0")}:${String(m.minuteOfDay % 60).padStart(2, "0")}`, texto).toBe(hora);
    }
  });

  it("NO es lo mismo que interpretarlo como UTC", () => {
    // Si alguien vuelve a poner `new Date(texto)`, este test lo agarra.
    const bien = parseLocalDateTime("2026-09-19T14:00", tz)!;
    const mal = new Date("2026-09-19T14:00");
    expect(bien.toISOString()).not.toBe(new Date("2026-09-19T14:00Z").toISOString());
    expect(bien.getTime() - Date.UTC(2026, 8, 19, 14, 0)).toBe(3 * 60 * 60 * 1000);
    expect(mal).toBeInstanceOf(Date);
  });

  it("acepta el texto con segundos que mandan algunos navegadores", () => {
    expect(parseLocalDateTime("2026-09-19T14:00:00", tz)!.toISOString()).toBe(
      "2026-09-19T17:00:00.000Z",
    );
  });

  it("un texto que no es una fecha devuelve null, no una fecha inventada", () => {
    expect(parseLocalDateTime("", tz)).toBeNull();
    expect(parseLocalDateTime("mañana a la tarde", tz)).toBeNull();
    expect(parseLocalDateTime("2026-09-19", tz)).toBeNull();
    expect(parseLocalDateTime("2026-13-19T14:00", tz)).toBeNull();
    expect(parseLocalDateTime("2026-09-19T25:00", tz)).toBeNull();
  });
});

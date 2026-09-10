import { describe, expect, it } from "vitest";
import { buildDayOffers, durationOptions, hoursLabel } from "./day-slots";
import { BOOKINGS_TIME_ZONE } from "./time";

const TZ = BOOKINGS_TIME_ZONE;

/** Un hueco de `minutos` que arranca a la hora local pedida del 12 de septiembre de 2026. */
function hueco(hora: string, minutos: number) {
  const startAt = new Date(`2026-09-12T${hora}:00-03:00`);
  return { startAt, endAt: new Date(startAt.getTime() + minutos * 60_000) };
}

describe("los horarios de entrada de un día", () => {
  it("agrupa los huecos por día y los ordena", () => {
    const dias = buildDayOffers({
      slots: [hueco("14:00", 60), hueco("09:00", 60)],
      timeZone: TZ,
      slotMinutes: 60,
      minBookingMinutes: 60,
      maxBookingMinutes: null,
    });
    expect(dias).toHaveLength(1);
    expect(dias[0]!.ymd).toBe("2026-09-12");
    expect(dias[0]!.starts.map((s) => s.label)).toEqual(["09:00", "14:00"]);
  });

  it("dice cuánto se puede estirar cada entrada", () => {
    // 09, 10 y 11 seguidos: desde las 09 entran tres horas; desde las 11, una.
    const dias = buildDayOffers({
      slots: [hueco("09:00", 60), hueco("10:00", 60), hueco("11:00", 60)],
      timeZone: TZ,
      slotMinutes: 60,
      minBookingMinutes: 60,
      maxBookingMinutes: null,
    });
    expect(dias[0]!.starts.map((s) => s.maxMinutes)).toEqual([180, 120, 60]);
  });

  it("corta el estirado donde hay un horario ocupado en el medio", () => {
    // Falta el hueco de las 12: la corrida de la mañana termina ahí.
    const dias = buildDayOffers({
      slots: [hueco("09:00", 60), hueco("10:00", 60), hueco("11:00", 60), hueco("14:00", 60)],
      timeZone: TZ,
      slotMinutes: 60,
      minBookingMinutes: 60,
      maxBookingMinutes: null,
    });
    const porHora = Object.fromEntries(dias[0]!.starts.map((s) => [s.label, s.maxMinutes]));
    expect(porHora["09:00"]).toBe(180);
    expect(porHora["14:00"]).toBe(60);
  });

  it("respeta el tope de duración del espacio", () => {
    const dias = buildDayOffers({
      slots: [hueco("09:00", 60), hueco("10:00", 60), hueco("11:00", 60)],
      timeZone: TZ,
      slotMinutes: 60,
      minBookingMinutes: 60,
      maxBookingMinutes: 120,
    });
    expect(dias[0]!.starts[0]!.maxMinutes).toBe(120);
  });

  it("con un mínimo de tres horas, cada entrada ya vale tres horas", () => {
    // El salón: los huecos que entrega la disponibilidad duran 180 y arrancan cada 60.
    const dias = buildDayOffers({
      slots: [hueco("19:00", 180), hueco("20:00", 180), hueco("21:00", 180)],
      timeZone: TZ,
      slotMinutes: 60,
      minBookingMinutes: 180,
      maxBookingMinutes: null,
    });
    expect(dias[0]!.starts.map((s) => s.maxMinutes)).toEqual([300, 240, 180]);
  });

  it("separa dos días distintos", () => {
    const dias = buildDayOffers({
      slots: [
        { startAt: new Date("2026-09-12T09:00:00-03:00"), endAt: new Date("2026-09-12T10:00:00-03:00") },
        { startAt: new Date("2026-09-14T09:00:00-03:00"), endAt: new Date("2026-09-14T10:00:00-03:00") },
      ],
      timeZone: TZ,
      slotMinutes: 60,
      minBookingMinutes: 60,
      maxBookingMinutes: null,
    });
    expect(dias.map((d) => d.ymd)).toEqual(["2026-09-12", "2026-09-14"]);
    expect(dias[1]!.dayNumber).toBe("14");
  });

  it("sin huecos no devuelve días", () => {
    expect(
      buildDayOffers({
        slots: [],
        timeZone: TZ,
        slotMinutes: 60,
        minBookingMinutes: 60,
        maxBookingMinutes: null,
      }),
    ).toEqual([]);
  });
});

describe("las duraciones que ofrece el selector", () => {
  it("va de la mínima al tope, de a un paso", () => {
    expect(durationOptions(300, 180, 60)).toEqual([180, 240, 300]);
  });

  it("con una sola duración posible ofrece esa", () => {
    expect(durationOptions(180, 180, 60)).toEqual([180]);
  });

  it("nunca devuelve vacío", () => {
    expect(durationOptions(0, 60, 60)).toEqual([60]);
  });
});

describe("cómo se escriben las horas", () => {
  it("usa coma para las medias", () => {
    expect(hoursLabel(90)).toBe("1,5 h");
    expect(hoursLabel(300)).toBe("5 h");
  });
});

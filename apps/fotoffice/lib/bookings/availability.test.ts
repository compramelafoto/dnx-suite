import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import { checkRange, computeAvailability, rejectionMessage } from "./availability";

const tz = BOOKINGS_TIME_ZONE;

/** Sábado 19/09/2026. En Argentina (UTC-3) las 09:00 locales son las 12:00Z. */
const local = (dia: number, hora: number, minuto = 0) =>
  new Date(Date.UTC(2026, 8, dia, hora + 3, minuto));

const espacio = {
  slotMinutes: 60,
  minBookingMinutes: 60,
  maxBookingMinutes: null,
  bufferMinutes: 0,
  minAdvanceHours: 2,
  maxAdvanceDays: 90,
};

/** Sábado de 9 a 13. */
const horarios = [{ weekday: 6, startMinute: 9 * 60, endMinute: 13 * 60 }];

const base = {
  space: espacio,
  weeklyHours: horarios,
  closures: [],
  busy: [],
  now: local(15, 10),
  timeZone: tz,
};

const sabado = { startAt: local(19, 0), endAt: local(20, 0) };

describe("los huecos de un día", () => {
  it("el sábado de 9 a 13 da cuatro horas libres", () => {
    const huecos = computeAvailability({ ...base, range: sabado });
    expect(huecos).toHaveLength(4);
    expect(huecos[0].startAt.toISOString()).toBe(local(19, 9).toISOString());
    expect(huecos[3].endAt.toISOString()).toBe(local(19, 13).toISOString());
  });

  it("un día sin horario declarado no tiene huecos", () => {
    const domingo = { startAt: local(20, 0), endAt: local(21, 0) };
    expect(computeAvailability({ ...base, range: domingo })).toHaveLength(0);
  });

  it("una reserva existente tapa su hora y solo esa", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      busy: [{ startAt: local(19, 10), endAt: local(19, 11) }],
    });
    expect(huecos).toHaveLength(3);
    expect(huecos.some((h) => h.startAt.getTime() === local(19, 10).getTime())).toBe(false);
  });

  it("la ocupación de un espacio incompatible tapa igual que la propia", () => {
    // El salón tomado de 10 a 12 llega acá dentro de `busy`: el motor no distingue de
    // quién es la ocupación, y por eso la regla de incompatibilidad no lo complica.
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      busy: [{ startAt: local(19, 10), endAt: local(19, 12) }],
    });
    expect(huecos.map((h) => h.startAt.getTime())).toEqual([
      local(19, 9).getTime(),
      local(19, 12).getTime(),
    ]);
  });

  it("el tiempo de limpieza también tapa", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      space: { ...espacio, bufferMinutes: 30 },
      busy: [{ startAt: local(19, 10), endAt: local(19, 11) }],
    });
    // De 9:30 a 11:30 queda ocupado, así que se caen las horas de 9 y de 11.
    expect(huecos.map((h) => h.startAt.getTime())).toEqual([local(19, 12).getTime()]);
  });

  it("un cierre institucional tapa el día entero", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      closures: [{ startAt: local(19, 0), endAt: local(20, 0) }],
    });
    expect(huecos).toHaveLength(0);
  });

  it("no se ofrece nada antes de la anticipación mínima", () => {
    const huecos = computeAvailability({ ...base, range: sabado, now: local(19, 10, 30) });
    // Con 2 horas de anticipación, desde las 10:30 lo primero disponible es a las 13 —
    // que ya está fuera de horario. No queda nada.
    expect(huecos).toHaveLength(0);
  });

  it("no se ofrece nada más allá de la anticipación máxima", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      space: { ...espacio, maxAdvanceDays: 1 },
    });
    expect(huecos).toHaveLength(0);
  });

  it("con grilla de media hora hay ocho huecos", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      space: { ...espacio, slotMinutes: 30, minBookingMinutes: 30 },
    });
    expect(huecos).toHaveLength(8);
  });

  it("un tramo que empieza a las 9:30 igual ofrece sus turnos", () => {
    // Recorriendo la ventana desde su borde (medianoche) en pasos de una hora, ninguna
    // hora en punto cae dentro de este tramo: sin el desfasaje, cero turnos.
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      weeklyHours: [{ weekday: 6, startMinute: 9 * 60 + 30, endMinute: 12 * 60 + 30 }],
    });
    expect(huecos).toHaveLength(3);
    expect(huecos[0].startAt.toISOString()).toBe(local(19, 9, 30).toISOString());
  });

  it("dos tramos en el mismo día se respetan por separado", () => {
    const huecos = computeAvailability({
      ...base,
      range: sabado,
      weeklyHours: [
        { weekday: 6, startMinute: 9 * 60, endMinute: 11 * 60 },
        { weekday: 6, startMinute: 16 * 60, endMinute: 18 * 60 },
      ],
    });
    expect(huecos.map((h) => h.startAt.getTime())).toEqual([
      local(19, 9).getTime(),
      local(19, 10).getTime(),
      local(19, 16).getTime(),
      local(19, 17).getTime(),
    ]);
  });
});

describe("validar un rango pedido", () => {
  const contexto = { ...base };

  it("un rango dentro del horario y libre se acepta", () => {
    expect(checkRange({ startAt: local(19, 9), endAt: local(19, 11) }, contexto)).toEqual({
      ok: true,
    });
  });

  it("un rango que se sale del horario se rechaza", () => {
    expect(checkRange({ startAt: local(19, 12), endAt: local(19, 14) }, contexto)).toEqual({
      ok: false,
      reason: "FUERA_DE_HORARIO",
    });
  });

  it("un rango sobre una reserva existente se rechaza", () => {
    const r = checkRange(
      { startAt: local(19, 9), endAt: local(19, 11) },
      { ...contexto, busy: [{ startAt: local(19, 10), endAt: local(19, 11) }] },
    );
    expect(r).toEqual({ ok: false, reason: "OCUPADO" });
  });

  it("un rango dentro de un cierre se rechaza", () => {
    const r = checkRange(
      { startAt: local(19, 9), endAt: local(19, 11) },
      { ...contexto, closures: [{ startAt: local(19, 8), endAt: local(19, 20) }] },
    );
    expect(r).toEqual({ ok: false, reason: "CERRADO" });
  });

  it("un rango más corto que el mínimo se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9), endAt: local(19, 9, 30) }, contexto);
    expect(r).toEqual({ ok: false, reason: "DURACION_INVALIDA" });
  });

  it("un rango más largo que el máximo se rechaza", () => {
    const r = checkRange(
      { startAt: local(19, 9), endAt: local(19, 13) },
      { ...contexto, space: { ...espacio, maxBookingMinutes: 120 } },
    );
    expect(r).toEqual({ ok: false, reason: "DURACION_INVALIDA" });
  });

  it("un rango que no arranca donde arrancan los turnos se rechaza", () => {
    const r = checkRange({ startAt: local(19, 9, 15), endAt: local(19, 10, 15) }, contexto);
    expect(r).toEqual({ ok: false, reason: "FUERA_DE_GRILLA" });
  });

  it("la grilla se mide desde el comienzo del tramo, no desde la medianoche", () => {
    // Un espacio que abre 09:30 con turnos de una hora arranca a las 9:30, no a las 10.
    const abre930 = {
      ...contexto,
      weeklyHours: [{ weekday: 6, startMinute: 9 * 60 + 30, endMinute: 13 * 60 }],
    };
    expect(checkRange({ startAt: local(19, 9, 30), endAt: local(19, 10, 30) }, abre930)).toEqual({
      ok: true,
    });
    expect(checkRange({ startAt: local(19, 10), endAt: local(19, 11) }, abre930)).toEqual({
      ok: false,
      reason: "FUERA_DE_GRILLA",
    });
  });

  it("un rango al revés o vacío se rechaza", () => {
    expect(checkRange({ startAt: local(19, 11), endAt: local(19, 9) }, contexto)).toEqual({
      ok: false,
      reason: "RANGO_INVALIDO",
    });
    expect(checkRange({ startAt: local(19, 9), endAt: local(19, 9) }, contexto)).toEqual({
      ok: false,
      reason: "RANGO_INVALIDO",
    });
  });

  it("un rango sobre la hora se rechaza con su propio motivo", () => {
    const r = checkRange(
      { startAt: local(19, 9), endAt: local(19, 11) },
      { ...contexto, now: local(19, 8) },
    );
    expect(r).toEqual({ ok: false, reason: "MUY_SOBRE_LA_HORA" });
  });

  it("cada motivo de rechazo tiene un texto que el socio entiende", () => {
    for (const motivo of [
      "FUERA_DE_HORARIO",
      "OCUPADO",
      "CERRADO",
      "MUY_SOBRE_LA_HORA",
      "DEMASIADO_LEJOS",
      "DURACION_INVALIDA",
      "FUERA_DE_GRILLA",
      "RANGO_INVALIDO",
    ] as const) {
      const texto = rejectionMessage(motivo);
      expect(texto, motivo).toBeTruthy();
      expect(texto.length).toBeGreaterThan(10);
      expect(texto).not.toContain("_");
    }
  });
});

import { describe, expect, it } from "vitest";
import { leerFranjas, textoDeFranja } from "./franjas";
import { agruparPorDia, horariosLibres, verificarHorario, ventanaDeBusqueda, type EntradaDisponibilidad } from "./disponibilidad";
import { puedeGestionarse } from "./plazo";
import { partirNombre, validarDatosDeReserva } from "./formulario";
import { armarIcs } from "./ics";
import { generarTokenDeGestion, hashDeToken, tokenConForma } from "./token";

// Viernes 6/11/2026 09:00 de Argentina (12:00 UTC).
const AHORA = new Date("2026-11-06T12:00:00.000Z");
const ar = (s: string) => new Date(`${s}:00.000-03:00`);

const base = (over: Partial<EntradaDisponibilidad> = {}): EntradaDisponibilidad => ({
  reglas: { durationMinutes: 30, bufferMinutes: 0, minAdvanceHours: 24, maxAdvanceDays: 7 },
  // Lunes 10 a 12.
  franjas: [{ weekday: 1, startMinute: 600, endMinute: 720 }],
  ocupado: [],
  ahora: AHORA,
  ...over,
});

describe("franjas", () => {
  it("lee, ordena y rechaza franjas inválidas o que se pisan", () => {
    expect(leerFranjas([{ weekday: 3, inicio: "15:00", fin: "18:00" }, { weekday: 1, inicio: "10:00", fin: "12:00" }])).toEqual([
      { weekday: 1, startMinute: 600, endMinute: 720 },
      { weekday: 3, startMinute: 900, endMinute: 1080 },
    ]);
    expect(leerFranjas([{ weekday: 1, inicio: "20:00", fin: "24:00" }])).toEqual([{ weekday: 1, startMinute: 1200, endMinute: 1440 }]);
    expect(leerFranjas([{ weekday: 1, inicio: "12:00", fin: "10:00" }])).toBeNull();
    expect(leerFranjas([{ weekday: 7, inicio: "10:00", fin: "11:00" }])).toBeNull();
    expect(leerFranjas([{ weekday: 1, inicio: "10:00", fin: "12:00" }, { weekday: 1, inicio: "11:00", fin: "13:00" }])).toBeNull();
    expect(leerFranjas("x")).toBeNull();
    expect(textoDeFranja({ weekday: 1, startMinute: 600, endMinute: 780 })).toBe("Lunes de 10:00 a 13:00");
  });
});

describe("disponibilidad", () => {
  it("ofrece los horarios del lunes en la grilla de la duración, en hora argentina", () => {
    const libres = horariosLibres(base());
    expect(libres.map((h) => h.startAt.toISOString())).toEqual([
      ar("2026-11-09T10:00").toISOString(),
      ar("2026-11-09T10:30").toISOString(),
      ar("2026-11-09T11:00").toISOString(),
      ar("2026-11-09T11:30").toISOString(),
    ]);
    expect(libres[0].endAt.toISOString()).toBe(ar("2026-11-09T10:30").toISOString());
  });

  it("saca lo ocupado, con el margen entre turnos", () => {
    const ocupado = [{ startAt: ar("2026-11-09T10:30"), endAt: ar("2026-11-09T11:00") }];
    expect(horariosLibres(base({ ocupado })).map((h) => h.startAt.getTime())).toEqual([ar("2026-11-09T10:00").getTime(), ar("2026-11-09T11:00").getTime(), ar("2026-11-09T11:30").getTime()]);
    const conMargen = base({ ocupado, reglas: { ...base().reglas, bufferMinutes: 15 } });
    expect(horariosLibres(conMargen).map((h) => h.startAt.getTime())).toEqual([ar("2026-11-09T11:30").getTime()]);
  });

  it("respeta la anticipación mínima y la máxima", () => {
    // Con 72 h de anticipación, el lunes 10:00 (73 h después) entra y el de 7 días no.
    const r = base({ reglas: { durationMinutes: 60, bufferMinutes: 0, minAdvanceHours: 72, maxAdvanceDays: 4 } });
    expect(horariosLibres(r).map((h) => h.startAt.getTime())).toEqual([ar("2026-11-09T10:00").getTime(), ar("2026-11-09T11:00").getTime()]);
    expect(horariosLibres(base({ reglas: { ...base().reglas, maxAdvanceDays: 2 } }))).toEqual([]);
  });

  it("verificarHorario acepta lo que se ofrece y rechaza lo ocupado o fuera de grilla", () => {
    expect(verificarHorario(ar("2026-11-09T10:30"), base())).toEqual({ ok: true });
    expect(verificarHorario(ar("2026-11-09T10:15"), base())).toEqual({ ok: false, reason: "FUERA_DE_GRILLA" });
    expect(verificarHorario(ar("2026-11-09T12:00"), base())).toEqual({ ok: false, reason: "FUERA_DE_HORARIO" });
    const ocupado = [{ startAt: ar("2026-11-09T10:00"), endAt: ar("2026-11-09T11:00") }];
    expect(verificarHorario(ar("2026-11-09T10:30"), base({ ocupado }))).toEqual({ ok: false, reason: "OCUPADO" });
  });

  it("la ventana arranca a la medianoche argentina de hoy", () => {
    const v = ventanaDeBusqueda(new Date("2026-11-07T02:00:00.000Z"), 1); // viernes 6, 23:00 AR
    expect(v.startAt.toISOString()).toBe("2026-11-06T03:00:00.000Z");
    expect(v.endAt.toISOString()).toBe("2026-11-08T03:00:00.000Z");
  });

  it("agrupa por día con etiqueta y hora", () => {
    const dias = agruparPorDia(horariosLibres(base({ franjas: [{ weekday: 1, startMinute: 600, endMinute: 660 }, { weekday: 2, startMinute: 1380, endMinute: 1440 }] })));
    expect(dias.map((d) => [d.ymd, d.etiqueta, d.horarios.map((h) => h.hora)])).toEqual([
      ["2026-11-09", "lunes, 9 de noviembre", ["10:00", "10:30"]],
      ["2026-11-10", "martes, 10 de noviembre", ["23:00", "23:30"]],
    ]);
  });
});

describe("plazo, formulario, ics y token", () => {
  it("se puede cambiar hasta 48 h antes", () => {
    const inicio = new Date("2026-11-10T13:00:00.000Z");
    expect(puedeGestionarse(inicio, new Date("2026-11-08T13:00:00.000Z"), 48)).toBe(true);
    expect(puedeGestionarse(inicio, new Date("2026-11-08T13:00:01.000Z"), 48)).toBe(false);
  });

  it("valida los datos del cliente", () => {
    expect(validarDatosDeReserva({ nombre: " Ana  Pérez ", correo: "ANA@x.com ", telefono: "341 555-1234", mensaje: " hola " })).toEqual({
      ok: true, datos: { nombre: "Ana Pérez", correo: "ana@x.com", telefono: "341 555-1234", mensaje: "hola" },
    });
    expect(validarDatosDeReserva({ nombre: "A", correo: "a@x.com", telefono: "123456" }).ok).toBe(false);
    expect(validarDatosDeReserva({ nombre: "Ana", correo: "ana", telefono: "123456" }).ok).toBe(false);
    expect(validarDatosDeReserva({ nombre: "Ana", correo: "a@x.com", telefono: "12" }).ok).toBe(false);
    expect(partirNombre("Ana María Pérez")).toEqual({ firstName: "Ana María", lastName: "Pérez" });
    expect(partirNombre("Ana")).toEqual({ firstName: "Ana", lastName: null });
  });

  it("arma un .ics con fechas UTC y texto escapado", () => {
    const ics = armarIcs({ uid: "t1@fotoffice", inicio: new Date("2026-11-09T13:00:00Z"), fin: new Date("2026-11-09T13:30:00Z"), titulo: "Llamada, DNX", lugar: "Rosario; Santa Fe", ahora: AHORA });
    expect(ics).toContain("DTSTART:20261109T130000Z");
    expect(ics).toContain("SUMMARY:Llamada\\, DNX");
    expect(ics).toContain("LOCATION:Rosario\; Santa Fe");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("el token sólo se guarda como hash", () => {
    const { token, hash } = generarTokenDeGestion();
    expect(tokenConForma(token)).toBe(true);
    expect(hash).toBe(hashDeToken(token));
    expect(hash).toHaveLength(64);
    expect(tokenConForma("../x")).toBe(false);
  });
});

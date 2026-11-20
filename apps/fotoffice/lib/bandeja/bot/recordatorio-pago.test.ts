import { describe, expect, it } from "vitest";
import { enHorarioDeEnvio, MARCA_RECORDATORIO, momentoDelSeguimiento, textoDelRecordatorio, tocaRecordar, tocaSeguimientoDeEvento } from "./recordatorio-pago";

const AHORA = new Date("2026-10-29T15:00:00Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

describe("tocaRecordar (pago y consultas: sin cambios)", () => {
  it("sólo entre las 20 y las 23:30 h desde el último mensaje del cliente", () => {
    expect(tocaRecordar(hace(19), AHORA)).toBe(false);
    expect(tocaRecordar(hace(20), AHORA)).toBe(true);
    expect(tocaRecordar(hace(23), AHORA)).toBe(true);
    expect(tocaRecordar(hace(23.6), AHORA)).toBe(false);
    expect(tocaRecordar(null, AHORA)).toBe(false);
  });
});

// Hora de Argentina (UTC−3) → Date.
const ar = (iso: string) => new Date(`${iso}-03:00`);

describe("momentoDelSeguimiento (22 h después del último mensaje, de 7 a 21 h, sin pasar las 24 h)", () => {
  it("si a las 22 h cae en horario, sale a las 22 h", () => {
    expect(momentoDelSeguimiento(ar("2026-11-20T12:00:00"))).toEqual(ar("2026-11-21T10:00:00"));
    expect(momentoDelSeguimiento(ar("2026-11-20T22:30:00"))).toEqual(ar("2026-11-21T20:30:00"));
  });
  it("si a las 22 h es de madrugada pero abre (7 h) antes de las 24 h, sale a las 7", () => {
    // 22 h después = 06:00; 23 h = 07:00.
    expect(momentoDelSeguimiento(ar("2026-11-20T08:00:00"))).toEqual(ar("2026-11-21T07:00:00"));
    // 22 h después = 05:30; a las 7 van 23,5 h: todavía entra.
    expect(momentoDelSeguimiento(ar("2026-11-20T07:30:00"))).toEqual(ar("2026-11-21T07:00:00"));
  });
  it("si todo el final de la ventana cae de noche, sale la tarde anterior antes de las 21", () => {
    // 22 h después = 21:30 (fuera de horario) y la ventana cierra a las 23:30: sale a las 20:30.
    expect(momentoDelSeguimiento(ar("2026-11-20T23:30:00"))).toEqual(ar("2026-11-21T20:30:00"));
    // 22 h después = 03:00: sale a las 20:30 del mismo día del mensaje.
    expect(momentoDelSeguimiento(ar("2026-11-20T05:00:00"))).toEqual(ar("2026-11-20T20:30:00"));
  });
});

describe("tocaSeguimientoDeEvento", () => {
  it("sale desde el momento elegido, sólo de 7 a 21 h y nunca pasadas las 23:45 h", () => {
    const u = ar("2026-11-20T12:00:00");
    expect(tocaSeguimientoDeEvento(u, ar("2026-11-21T09:45:00"))).toBe(false);
    expect(tocaSeguimientoDeEvento(u, ar("2026-11-21T10:00:00"))).toBe(true);
    expect(tocaSeguimientoDeEvento(u, ar("2026-11-21T11:30:00"))).toBe(true);
    expect(tocaSeguimientoDeEvento(u, ar("2026-11-21T12:00:00"))).toBe(false);
    const noche = ar("2026-11-20T05:00:00");
    expect(tocaSeguimientoDeEvento(noche, ar("2026-11-20T20:15:00"))).toBe(false);
    expect(tocaSeguimientoDeEvento(noche, ar("2026-11-20T20:30:00"))).toBe(true);
    expect(tocaSeguimientoDeEvento(noche, ar("2026-11-20T20:45:00"))).toBe(true);
    expect(tocaSeguimientoDeEvento(noche, ar("2026-11-20T21:00:00"))).toBe(false);
    expect(tocaSeguimientoDeEvento(null, ar("2026-11-21T10:00:00"))).toBe(false);
  });
  it("nunca de 21 a 7 h", () => {
    expect(enHorarioDeEnvio(ar("2026-11-20T06:59:00"))).toBe(false);
    expect(enHorarioDeEnvio(ar("2026-11-20T07:00:00"))).toBe(true);
    expect(enHorarioDeEnvio(ar("2026-11-20T20:59:00"))).toBe(true);
    expect(enHorarioDeEnvio(ar("2026-11-20T21:00:00"))).toBe(false);
  });
});

describe("textoDelRecordatorio", () => {
  it("pedido del catálogo: el número, lo que falta pagar y el enlace", () => {
    const t = textoDelRecordatorio("Daniel Cuart", { tipo: "PEDIDO", numero: "2026-0042", aPagar: 43000, url: "https://fotoffice.com/p/tok", creado: AHORA });
    expect(t).toContain("¡Hola Daniel!");
    expect(t).toContain("2026-0042");
    expect(t).toContain("43.000");
    expect(t).toContain("https://fotoffice.com/p/tok");
  });

  it("copias: ofrece mandar el enlace de nuevo (el de Mercado Pago no se guarda)", () => {
    const t = textoDelRecordatorio(null, { tipo: "IMPRESION", numero: 12, aPagar: 5000, creado: AHORA });
    expect(t.startsWith("¡Hola!")).toBe(true);
    expect(t).toContain("N° 12");
    expect(t).toContain("5.000");
    expect(t).toContain("enlace");
  });

  it("si el estudio cobra por transferencia, no manda el link: pide el comprobante y ofrece los datos", () => {
    const t = textoDelRecordatorio("Lucía", { tipo: "PEDIDO", numero: "2026-0042", aPagar: 43000, url: "https://fotoffice.com/p/tok", creado: AHORA }, true);
    expect(t).not.toContain("https://");
    expect(t).toContain("comprobante");
    expect(t).toContain("datos para transferir");
    expect(textoDelRecordatorio(null, { tipo: "IMPRESION", numero: 12, aPagar: 5000, creado: AHORA }, true)).not.toContain("enlace");
  });

  it("la marca del chat dice qué pedido se recordó", () => {
    expect(MARCA_RECORDATORIO).toBe("Recordatorio de pago enviado");
  });
});

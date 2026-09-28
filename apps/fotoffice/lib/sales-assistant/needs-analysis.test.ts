import { describe, expect, it } from "vitest";
import type { OportunidadVenta } from "./opportunity";
import { diasEntre, necesitaAnalisis, ultimoSeguimientoQueCuenta, type UltimaSugerencia } from "./needs-analysis";

const HOY = new Date("2026-09-28T10:00:00Z");
function op(p: Partial<OportunidadVenta> = {}): OportunidadVenta {
  return {
    fuente: "ALBOOM", idExterno: "1", titulo: "XV", tipoEvento: "XV", nombreCliente: "Sabrina",
    apellidoCliente: "B", telefono: null, email: null,
    fechaEvento: new Date("2027-01-01T00:00:00Z"), lugar: null, ciudad: null, invitados: null,
    origen: null, descripcionCliente: null, embudo: "E", etapa: "Recepción", etapaOrden: 1,
    etapasTotal: 6, abierta: true, creadaEn: new Date("2026-09-20T00:00:00Z"),
    presupuestoEnviadoEn: null, modificadaEn: new Date("2026-09-20T00:00:00Z"), movimientos: [], ...p,
  };
}
function ultima(p: Partial<UltimaSugerencia> = {}): UltimaSugerencia {
  return {
    creadaEn: new Date("2026-09-27T10:00:00Z"), accion: "ESCRIBIR", estado: "PENDIENTE",
    esperarHasta: null, oportunidadModificadaEn: new Date("2026-09-20T00:00:00Z"), ...p,
  };
}
const base = { ultimoSeguimientoEn: null, archivada: false, forzar: false, hoy: HOY };

describe("necesitaAnalisis", () => {
  it("analiza una oportunidad nunca analizada", () => {
    expect(necesitaAnalisis({ ...base, oportunidad: op(), ultima: null }).analizar).toBe(true);
  });
  it("no analiza si nada cambió", () => {
    expect(necesitaAnalisis({ ...base, oportunidad: op(), ultima: ultima() }).analizar).toBe(false);
  });
  it("analiza si cambió en Alboom después del último análisis", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op({ modificadaEn: new Date("2026-09-28T08:00:00Z") }), ultima: ultima(),
    });
    expect(r).toEqual({ analizar: true, motivo: "Cambió en el CRM" });
  });
  it("analiza si hay un seguimiento posterior al último análisis", () => {
    const r = necesitaAnalisis({
      ...base, ultimoSeguimientoEn: new Date("2026-09-27T20:00:00Z"), oportunidad: op(), ultima: ultima(),
    });
    expect(r.analizar).toBe(true);
  });
  it("analiza cuando venció la espera", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op(),
      ultima: ultima({ accion: "ESPERAR", esperarHasta: new Date("2026-09-28T00:00:00Z") }),
    });
    expect(r).toEqual({ analizar: true, motivo: "Venció la espera" });
  });
  it("analiza cuando una sugerencia enviada lleva los días de espera sin novedad", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op(),
      ultima: ultima({ estado: "ENVIADA", creadaEn: new Date("2026-09-24T10:00:00Z") }),
    });
    expect(r.analizar).toBe(true);
  });
  it("analiza cuando el evento cruzó el umbral de 30 días", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op({ fechaEvento: new Date("2026-10-27T00:00:00Z") }),
      ultima: ultima({ creadaEn: new Date("2026-09-26T10:00:00Z") }),
    });
    expect(r).toEqual({ analizar: true, motivo: "El evento está a menos de 30 días" });
  });
  it("nunca analiza una archivada ni una cerrada", () => {
    expect(necesitaAnalisis({ ...base, archivada: true, oportunidad: op(), ultima: null }).analizar).toBe(false);
    expect(necesitaAnalisis({ ...base, oportunidad: op({ abierta: false }), ultima: null }).analizar).toBe(false);
  });
  it("forzar gana a todo menos a cerrada", () => {
    expect(necesitaAnalisis({ ...base, forzar: true, oportunidad: op(), ultima: ultima() }).analizar).toBe(true);
  });
});

describe("diasEntre", () => {
  it("cuenta 0 días si ambas instantes caen el mismo día ART", () => {
    // 2026-11-28T03:00:00Z = 00:00 ART 28/11
    // 2026-11-29T02:00:00Z = 23:00 ART 28/11 (mismo día calendario en Argentina)
    expect(diasEntre(new Date("2026-11-28T03:00:00Z"), new Date("2026-11-29T02:00:00Z"))).toBe(0);
  });
  it("cuenta 1 día cuando cruza medianoche ART", () => {
    // 2026-11-28T03:00:00Z = 00:00 ART 28/11
    // 2026-11-29T04:00:00Z = 01:00 ART 29/11 (día siguiente)
    expect(diasEntre(new Date("2026-11-28T03:00:00Z"), new Date("2026-11-29T04:00:00Z"))).toBe(1);
  });
  it("maneja diferencias negativas correctamente", () => {
    // hasta antes de desde → resultado negativo
    expect(diasEntre(new Date("2026-11-29T04:00:00Z"), new Date("2026-11-28T03:00:00Z"))).toBe(-1);
  });
});

describe("ultimoSeguimientoQueCuenta", () => {
  it("ignora los MENSAJE_ENVIADO: anotar un envío no es una novedad del cliente", () => {
    expect(
      ultimoSeguimientoQueCuenta([
        { tipo: "RESULTADO", fecha: new Date("2026-09-20T10:00:00Z") },
        { tipo: "MENSAJE_ENVIADO", fecha: new Date("2026-09-27T10:00:00Z") },
      ]),
    ).toEqual(new Date("2026-09-20T10:00:00Z"));
  });
  it("toma el más nuevo entre RESULTADO y NOTA, sin importar el orden", () => {
    expect(
      ultimoSeguimientoQueCuenta([
        { tipo: "NOTA", fecha: new Date("2026-09-25T10:00:00Z") },
        { tipo: "RESULTADO", fecha: new Date("2026-09-21T10:00:00Z") },
      ]),
    ).toEqual(new Date("2026-09-25T10:00:00Z"));
  });
  it("con sólo envíos da null, y un envío después del análisis no dispara uno nuevo", () => {
    const soloEnvio = ultimoSeguimientoQueCuenta([{ tipo: "MENSAJE_ENVIADO", fecha: new Date("2026-09-27T20:00:00Z") }]);
    expect(soloEnvio).toBeNull();
    expect(necesitaAnalisis({ ...base, ultimoSeguimientoEn: soloEnvio, oportunidad: op(), ultima: ultima() }).analizar).toBe(false);
  });
});

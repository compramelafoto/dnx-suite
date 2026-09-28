import { describe, expect, it } from "vitest";
import type { OportunidadVenta } from "./opportunity";
import { necesitaAnalisis, type UltimaSugerencia } from "./needs-analysis";

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

import { describe, expect, it } from "vitest";
import { puedeReemitirEnlace } from "./reenvio-enlace";

const todoEnOrden = { tieneDestinatario: true, tieneAppUrl: true };

describe("puedeReemitirEnlace", () => {
  it("se puede en los cuatro estados en que el pedido sigue vivo", () => {
    for (const status of ["RECIBIDA", "EN_EVALUACION", "REQUIERE_INFO", "APROBADA"]) {
      expect(puedeReemitirEnlace({ status, ...todoEnOrden }), status).toEqual({ ok: true });
    }
  });

  it("no se puede cuando el circuito ya terminó", () => {
    // Un rechazo no lleva enlace a propósito (ver `buildRequestRejectedEmail`): mandarle uno
    // ahora la invitaría a volver a mirar un "no".
    for (const status of [
      "RECHAZADA",
      "CERRADA",
      "CANCELADA_SOLICITANTE",
      "CANCELADA_ORGANIZACION",
    ]) {
      expect(puedeReemitirEnlace({ status, ...todoEnOrden }).ok, status).toBe(false);
    }
  });

  it("un estado que no existe tampoco pasa", () => {
    expect(puedeReemitirEnlace({ status: "INVENTADA", ...todoEnOrden }).ok).toBe(false);
  });

  it("sin correo cargado no se emite nada: rotar dejaría el enlace muerto y sin reemplazo", () => {
    const r = puedeReemitirEnlace({
      status: "APROBADA",
      tieneDestinatario: false,
      tieneAppUrl: true,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/dirección de correo/);
  });

  it("sin appUrl tampoco: no habría con qué armar el enlace", () => {
    const r = puedeReemitirEnlace({
      status: "APROBADA",
      tieneDestinatario: true,
      tieneAppUrl: false,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/dirección pública/);
  });

  it("sobre un pedido terminado, el motivo habla del pedido y no de la configuración", () => {
    // Contarle a quien mira que "falta configurar la appUrl" sobre un pedido que ya se cerró es
    // explicar algo que no viene al caso, y manda a revisar donde no hay nada que arreglar.
    const r = puedeReemitirEnlace({
      status: "RECHAZADA",
      tieneDestinatario: false,
      tieneAppUrl: false,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/circuito terminó/);
  });
});

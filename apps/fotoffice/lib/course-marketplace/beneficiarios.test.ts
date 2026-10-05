import { describe, expect, it } from "vitest";
import {
  beneficiariosParaMotor,
  esSinReparto,
  estadoDeVenta,
  estadoTrasGuardar,
  validarFilas,
  type BeneficiarioRegistrado,
  type FilaBeneficiario,
} from "./beneficiarios";

const owner = { workspaceId: "ws-sfpr", nombre: "SFPR" };

function reg(p: Partial<BeneficiarioRegistrado> & { id: string }): BeneficiarioRegistrado {
  return {
    workspaceId: `ws-${p.id}`,
    invitedEmail: null,
    nombre: p.id,
    role: "OTRO",
    shareBps: 5000,
    absorbsProcessorFee: false,
    status: "ACEPTADO",
    mpConectado: true,
    ...p,
  };
}

describe("validar la lista que arma el dueño", () => {
  const fila = (p: Partial<FilaBeneficiario>): FilaBeneficiario => ({
    workspaceId: "ws-a",
    invitedEmail: null,
    role: "DOCENTE",
    shareBps: 10000,
    absorbsProcessorFee: true,
    ...p,
  });

  it("una lista correcta no tiene errores", () => {
    expect(validarFilas([fila({ shareBps: 7000 }), fila({ workspaceId: "ws-b", role: "PRODUCTOR", shareBps: 3000, absorbsProcessorFee: false })])).toEqual([]);
  });

  it("cada fila es un negocio o un correo, no las dos cosas ni ninguna", () => {
    expect(validarFilas([fila({ workspaceId: null })]).join()).toMatch(/negocio o un correo/);
    expect(validarFilas([fila({ invitedEmail: "a@b.com" })]).join()).toMatch(/negocio o un correo/);
  });

  it("un correo inválido", () => {
    expect(validarFilas([fila({ workspaceId: null, invitedEmail: "no-es" })]).join()).toMatch(/correo/);
  });

  it("el mismo negocio o el mismo correo dos veces", () => {
    expect(validarFilas([fila({ shareBps: 5000 }), fila({ shareBps: 5000, absorbsProcessorFee: false })]).join()).toMatch(/repetido/);
  });

  it("suma distinta de 100% y absorbe MP", () => {
    expect(validarFilas([fila({ shareBps: 9000 })]).join()).toMatch(/suman 90%/);
    expect(validarFilas([fila({ absorbsProcessorFee: false })]).join()).toMatch(/absorber/);
  });

  it("lista vacía y porcentajes en cero o no enteros", () => {
    expect(validarFilas([]).length).toBeGreaterThan(0);
    expect(validarFilas([fila({ shareBps: 0 })]).join()).toMatch(/mayor que cero/);
    expect(validarFilas([fila({ shareBps: 10000.5 })]).join()).toMatch(/mayor que cero/);
  });

  it("más de 11 beneficiarios", () => {
    const filas = Array.from({ length: 12 }, (_, i) => fila({ workspaceId: `ws-${i}`, shareBps: i === 0 ? 10000 - 11 * 800 : 800, absorbsProcessorFee: i === 0 }));
    expect(validarFilas(filas).join()).toMatch(/como máximo/);
  });
});

describe("si un curso se vende sin reparto", () => {
  it("sin filas: el dueño al 100%", () => {
    expect(esSinReparto("ws-sfpr", [])).toBe(true);
    expect(beneficiariosParaMotor(owner, [])).toEqual([{ id: "ws-sfpr", nombre: "SFPR", bps: 10000, absorbeMp: true }]);
  });

  it("una sola fila que es el dueño al 100%", () => {
    expect(esSinReparto("ws-sfpr", [{ workspaceId: "ws-sfpr", shareBps: 10000 }])).toBe(true);
  });

  it("una sola fila de correo invitado al 100% tiene reparto", () => {
    expect(esSinReparto("ws-sfpr", [{ workspaceId: null, shareBps: 10000 }])).toBe(false);
  });

  it("con una sola fila, ella absorbe la comisión aunque no lo diga", () => {
    const [b] = beneficiariosParaMotor(owner, [{ id: "x", workspaceId: "ws-maxi", nombre: "Maxi", shareBps: 10000, absorbsProcessorFee: false }]);
    expect(b.absorbeMp).toBe(true);
  });

  it("cualquier otro caso tiene reparto", () => {
    expect(esSinReparto("ws-sfpr", [{ workspaceId: "ws-maxi", shareBps: 10000 }])).toBe(false);
    expect(esSinReparto("ws-sfpr", [{ workspaceId: "ws-sfpr", shareBps: 3000 }, { workspaceId: "ws-maxi", shareBps: 7000 }])).toBe(false);
  });
});

describe("qué falta para vender con reparto", () => {
  it("sin reparto se vende hoy", () => {
    expect(estadoDeVenta("ws-sfpr", [])).toEqual({ tipo: "SIN_REPARTO" });
  });

  it("todo aceptado y conectado: listo", () => {
    const lista = [reg({ id: "a", absorbsProcessorFee: true }), reg({ id: "b" })];
    expect(estadoDeVenta("ws-sfpr", lista)).toEqual({ tipo: "CON_REPARTO", listo: true, faltantes: [] });
  });

  it("una fila sin negocio nunca está lista, aunque figure aceptada y conectada", () => {
    const lista = [reg({ id: "a", absorbsProcessorFee: true, workspaceId: null, invitedEmail: "a@b.com" }), reg({ id: "b" })];
    const e = estadoDeVenta("ws-sfpr", lista);
    expect(e.tipo === "CON_REPARTO" && e.listo).toBe(false);
    expect(e.tipo === "CON_REPARTO" && e.faltantes).toContain("a todavía no tiene su negocio en FOTOFFICE.");
  });

  it("dice quién falta y por qué", () => {
    const lista = [
      reg({ id: "a", absorbsProcessorFee: true, status: "INVITADO" }),
      reg({ id: "b", mpConectado: false }),
      reg({ id: "c", status: "RECHAZADO", shareBps: 0 }),
    ];
    const e = estadoDeVenta("ws-sfpr", lista);
    expect(e.tipo === "CON_REPARTO" && e.listo).toBe(false);
    const texto = e.tipo === "CON_REPARTO" ? e.faltantes.join(" | ") : "";
    expect(texto).toMatch(/a todavía no aceptó/);
    expect(texto).toMatch(/b no conectó Mercado Pago/);
    expect(texto).toMatch(/c rechazó/);
  });
});

describe("estado de un beneficiario al guardar la lista", () => {
  const fila: FilaBeneficiario = { workspaceId: "ws-a", invitedEmail: null, role: "DOCENTE", shareBps: 5000, absorbsProcessorFee: false };
  const previo = (status: "INVITADO" | "ACEPTADO" | "RECHAZADO") => ({ status, ...fila });

  it("una fila nueva queda invitada", () => {
    expect(estadoTrasGuardar(null, fila, false)).toEqual({ status: "INVITADO", cambiaron: true });
  });

  it("el dueño queda aceptado siempre", () => {
    expect(estadoTrasGuardar(null, fila, true).status).toBe("ACEPTADO");
    expect(estadoTrasGuardar(previo("INVITADO"), { ...fila, shareBps: 4000 }, true).status).toBe("ACEPTADO");
  });

  it.each([
    ["el porcentaje", { shareBps: 4000 }],
    ["el rol", { role: "PRODUCTOR" as const }],
    ["quién absorbe la comisión de MP", { absorbsProcessorFee: true }],
    ["el negocio", { workspaceId: "ws-b" }],
    ["el correo", { workspaceId: null, invitedEmail: "x@y.com" }],
  ])("si cambia %s, el aceptado vuelve a invitado", (_n, cambio) => {
    expect(estadoTrasGuardar(previo("ACEPTADO"), { ...fila, ...cambio }, false)).toEqual({ status: "INVITADO", cambiaron: true });
  });

  it.each(["ACEPTADO", "RECHAZADO"] as const)("sin cambios conserva %s", (status) => {
    expect(estadoTrasGuardar(previo(status), fila, false)).toEqual({ status, cambiaron: false });
  });
});

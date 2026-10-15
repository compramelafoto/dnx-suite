import { describe, expect, it } from "vitest";
import { puede, puedeEnContexto, type AccesoEfectivo, type Capacidad } from "./policy";
import { etiquetaRol, normalizarRol } from "./roles";

/**
 * Con sólo el rol (string), `puede` aplica las reglas de rol de main y el filtro grueso de
 * "trabaja en la institución". El acceso por módulo se prueba en `adaptador.test.ts`.
 */
const MATRIZ_POR_ROL: Record<string, Record<Capacidad, boolean>> = {
  WORKSPACE_OWNER: { ver: true, operar: true, verDinero: true, configurar: true, gestionarEquipo: true, transferirPropiedad: true, verSoloAsignado: false },
  WORKSPACE_ADMIN: { ver: true, operar: true, verDinero: true, configurar: true, gestionarEquipo: true, transferirPropiedad: false, verSoloAsignado: false },
  STAFF: { ver: true, operar: true, verDinero: false, configurar: false, gestionarEquipo: false, transferirPropiedad: false, verSoloAsignado: false },
  COLLABORATOR: { ver: false, operar: false, verDinero: false, configurar: false, gestionarEquipo: false, transferirPropiedad: false, verSoloAsignado: true },
};

describe("puede — sólo con el rol", () => {
  for (const [rol, fila] of Object.entries(MATRIZ_POR_ROL)) {
    for (const [cap, esperado] of Object.entries(fila)) {
      it(`${rol} · ${cap} = ${esperado}`, () => {
        expect(puede(rol, cap as Capacidad)).toBe(esperado);
      });
    }
  }
  it("legacy ADMIN configura (como canManageWorkspaceSettings) pero no transfiere", () => {
    expect(puede("ADMIN", "configurar")).toBe(true);
    expect(puede("ADMIN", "transferirPropiedad")).toBe(false);
  });
  it("sin rol o rol desconocido no otorga nada", () => {
    for (const cap of Object.keys(MATRIZ_POR_ROL.STAFF) as Capacidad[]) {
      expect(puede(null, cap)).toBe(false);
      expect(puede(undefined, cap)).toBe(false);
      expect(puede("ALGO_INVENTADO", cap)).toBe(false);
    }
  });
});

describe("puede — con el acceso resuelto", () => {
  const acceso: AccesoEfectivo = { role: "STAFF", levels: { clients: "MANAGE", members: "VIEW", cash: "NONE" } };

  it("operar y ver se miden en el módulo pedido", () => {
    expect(puede(acceso, "operar", "clients")).toBe(true);
    expect(puede(acceso, "operar", "members")).toBe(false);
    expect(puede(acceso, "ver", "members")).toBe(true);
    expect(puede(acceso, "ver", "cash")).toBe(false);
  });
  it("con varios módulos alcanza con uno", () => {
    expect(puede(acceso, "operar", ["members", "clients"])).toBe(true);
    expect(puede(acceso, "operar", ["members", "cash"])).toBe(false);
  });
  it("sin módulo, operar no se concede", () => {
    expect(puede(acceso, "operar")).toBe(false);
  });
  it("verDinero: Ver en Caja o en Cuotas, o dueño/admin", () => {
    expect(puede(acceso, "verDinero")).toBe(false);
    expect(puede({ role: "STAFF", levels: { cash: "VIEW" } }, "verDinero")).toBe(true);
    expect(puede({ role: "STAFF", levels: { "membership-dues": "VIEW" } }, "verDinero")).toBe(true);
    expect(puede({ role: "WORKSPACE_ADMIN", levels: {} }, "verDinero")).toBe(true);
  });
  it("puedeEnContexto usa el acceso si está y si no el rol", () => {
    expect(puedeEnContexto({ role: "STAFF", acceso }, "operar", "members")).toBe(false);
    expect(puedeEnContexto({ role: "STAFF" }, "operar", "members")).toBe(true);
  });
});

describe("roles", () => {
  it("normaliza y etiqueta", () => {
    expect(normalizarRol("STAFF")).toBe("EQUIPO");
    expect(etiquetaRol("WORKSPACE_OWNER")).toBe("Dueño");
    expect(etiquetaRol("WORKSPACE_ADMIN")).toBe("Administrador");
    expect(etiquetaRol("STAFF")).toBe("Equipo");
    expect(etiquetaRol("COLLABORATOR")).toBe("Colaborador");
    expect(etiquetaRol(null)).toBe("Sin acceso");
  });
});

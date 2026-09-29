import { describe, expect, it } from "vitest";
import { puede, type Capacidad } from "./policy";
import { etiquetaRol, normalizarRol } from "./roles";

const MATRIZ: Record<string, Record<Capacidad, boolean>> = {
  WORKSPACE_OWNER: { operar: true, verDinero: true, configurar: true, gestionarEquipo: true, transferirPropiedad: true, verSoloAsignado: false },
  WORKSPACE_ADMIN: { operar: true, verDinero: true, configurar: true, gestionarEquipo: true, transferirPropiedad: false, verSoloAsignado: false },
  STAFF: { operar: true, verDinero: true, configurar: false, gestionarEquipo: false, transferirPropiedad: false, verSoloAsignado: false },
  COLLABORATOR: { operar: false, verDinero: false, configurar: false, gestionarEquipo: false, transferirPropiedad: false, verSoloAsignado: true },
};

describe("puede — matriz rol × capacidad", () => {
  for (const [rol, fila] of Object.entries(MATRIZ)) {
    for (const [cap, esperado] of Object.entries(fila)) {
      it(`${rol} · ${cap} = ${esperado}`, () => {
        expect(puede(rol, cap as Capacidad)).toBe(esperado);
      });
    }
  }
  it("legacy ADMIN equivale a Administrador", () => {
    expect(puede("ADMIN", "configurar")).toBe(true);
    expect(puede("ADMIN", "transferirPropiedad")).toBe(false);
  });
  it("legacy MEMBER equivale a Equipo", () => {
    expect(puede("MEMBER", "operar")).toBe(true);
    expect(puede("MEMBER", "configurar")).toBe(false);
  });
  it("sin rol o rol desconocido no otorga nada", () => {
    for (const cap of Object.keys(MATRIZ.STAFF) as Capacidad[]) {
      expect(puede(null, cap)).toBe(false);
      expect(puede(undefined, cap)).toBe(false);
      expect(puede("ALGO_INVENTADO", cap)).toBe(false);
    }
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

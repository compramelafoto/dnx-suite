import { describe, expect, it } from "vitest";
import { bloqueDeCodigo, bloqueDeRubro } from "./bloques";

describe("bloqueDeCodigo", () => {
  it("3, 4 y 5 son ingresos, costos y gastos", () => {
    expect(bloqueDeCodigo("3")).toBe("INGRESOS");
    expect(bloqueDeCodigo("3.1.2")).toBe("INGRESOS");
    expect(bloqueDeCodigo("4.2")).toBe("COSTOS");
    expect(bloqueDeCodigo("5.10")).toBe("GASTOS");
  });
  it("sin código u otro primer dígito no tiene bloque", () => {
    expect(bloqueDeCodigo(null)).toBeNull();
    expect(bloqueDeCodigo("")).toBeNull();
    expect(bloqueDeCodigo("1.1")).toBeNull();
    expect(bloqueDeCodigo("A-3")).toBeNull();
    expect(bloqueDeCodigo("13")).toBeNull();
  });
});

describe("bloqueDeRubro", () => {
  const padre = { id: "p", codigo: "4", parentId: null };
  const mapa = new Map([["p", padre]]);
  it("un hijo sin código hereda el bloque del padre", () => {
    expect(bloqueDeRubro({ id: "h", codigo: null, parentId: "p" }, mapa)).toBe("COSTOS");
  });
  it("un hijo con código propio usa el suyo", () => {
    expect(bloqueDeRubro({ id: "h", codigo: "5.1", parentId: "p" }, mapa)).toBe("GASTOS");
  });
  it("sin padre ni código no tiene bloque; un padre inexistente o él mismo tampoco", () => {
    expect(bloqueDeRubro({ id: "h", codigo: null, parentId: null }, mapa)).toBeNull();
    expect(bloqueDeRubro({ id: "h", codigo: null, parentId: "x" }, mapa)).toBeNull();
    expect(bloqueDeRubro({ id: "h", codigo: null, parentId: "h" }, mapa)).toBeNull();
  });
});

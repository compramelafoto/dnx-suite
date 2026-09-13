import { describe, expect, it } from "vitest";
import { seedRowsFor } from "./seed";

describe("seedRowsFor", () => {
  it("crea caja diaria, caja fuerte y Mercado Pago, y la diaria es la de omisión", () => {
    const { accounts } = seedRowsFor("ws-1");
    expect(accounts.map((a) => a.name)).toEqual(["Caja diaria", "Caja fuerte", "Mercado Pago"]);
    expect(accounts[0].isDefault).toBe(true);
    expect(accounts[0].kind).toBe("EFECTIVO");
    expect(accounts[2].kind).toBe("DIGITAL");
  });

  it("la caja fuerte queda marcada como bóveda y la diaria no", () => {
    const { accounts } = seedRowsFor("ws-1");
    expect(accounts[0].isVault).toBe(false);
    expect(accounts[1].isVault).toBe(true);
  });

  it("todas las filas llevan el workspace recibido", () => {
    const { accounts, categories } = seedRowsFor("ws-9");
    expect(accounts.every((a) => a.workspaceId === "ws-9")).toBe(true);
    expect(categories.every((c) => c.workspaceId === "ws-9")).toBe(true);
  });

  it("hay categorías de los dos lados", () => {
    const { categories } = seedRowsFor("ws-1");
    expect(categories.some((c) => c.kind === "INGRESO")).toBe(true);
    expect(categories.some((c) => c.kind === "EGRESO")).toBe(true);
  });

  it("ninguna categoría se repite dentro del mismo lado", () => {
    const { categories } = seedRowsFor("ws-1");
    const claves = categories.map((c) => `${c.kind}|${c.name}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("dos workspaces distintos no comparten ninguna fila", () => {
    const a = seedRowsFor("ws-a");
    const b = seedRowsFor("ws-b");
    expect(a.accounts[0]).not.toBe(b.accounts[0]);
    expect(a.accounts[0].workspaceId).toBe("ws-a");
    expect(b.accounts[0].workspaceId).toBe("ws-b");
  });
});

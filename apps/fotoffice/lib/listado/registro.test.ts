import { describe, expect, it } from "vitest";
import { definicionDe, entradaDeLista, LISTAS } from "./registro";
import type { ContextoListado } from "./tipos";

describe("registro de listas", () => {
  it("tiene las listas de la etapa con su módulo", () => {
    expect(Object.fromEntries(Object.entries(LISTAS).map(([k, v]) => [k, v.moduleKey]))).toEqual({
      clientes: "clients",
      socios: "members",
      "caja-movimientos": "cash",
      captacion: "service-leads",
      presupuestos: "quotes",
      pedidos: "orders",
      "pedidos-a-pagar": "orders",
    });
  });

  it("cada lista declara su ruta", () => {
    expect(Object.fromEntries(Object.entries(LISTAS).map(([k, v]) => [k, v.ruta]))).toEqual({
      clientes: "/clientes",
      socios: "/members",
      "caja-movimientos": "/caja/movimientos",
      captacion: "/consultas/lista",
      presupuestos: "/presupuestos",
      pedidos: "/pedidos",
      "pedidos-a-pagar": "/pedidos/a-pagar",
    });
  });
});

describe("claves que no son listas", () => {
  const ctx: ContextoListado = { workspaceId: "w", workspaceName: "W", userId: 1, userLabel: "x", role: "WORKSPACE_OWNER" };
  const heredadas = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "inventada", ""];

  it("las heredadas del prototipo cuentan como desconocidas", () => {
    for (const c of heredadas) expect(entradaDeLista(c)).toBeNull();
    expect(entradaDeLista("clientes")?.ruta).toBe("/clientes");
  });

  it("definicionDe devuelve null sin cargar nada", async () => {
    for (const c of heredadas) expect(await definicionDe(c, ctx)).toBeNull();
  });
});

describe("listas enteras de dinero", () => {
  const base = { workspaceId: "w", workspaceName: "W", userId: 1, userLabel: "x" };
  const ctx = (role: string, levels: Record<string, string>): ContextoListado => ({ ...base, role, acceso: { role, levels } as never, modulo: "orders" });

  it("A pagar exige ver costos (configurar o verDinero): sin eso, no hay definición", async () => {
    const { listaPermitida } = await import("./registro");
    const sinDinero = ctx("STAFF", { orders: "MANAGE" });
    expect(listaPermitida("pedidos-a-pagar", sinDinero)).toBe(false);
    expect(await definicionDe("pedidos-a-pagar", sinDinero)).toBeNull();
    expect(listaPermitida("pedidos", sinDinero)).toBe(true);
    expect(listaPermitida("pedidos-a-pagar", ctx("STAFF", { orders: "VIEW", cash: "VIEW" }))).toBe(true);
    expect(listaPermitida("pedidos-a-pagar", ctx("WORKSPACE_ADMIN", {}))).toBe(true);
  });
});

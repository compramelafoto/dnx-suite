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
    });
  });

  it("cada lista declara su ruta", () => {
    expect(Object.fromEntries(Object.entries(LISTAS).map(([k, v]) => [k, v.ruta]))).toEqual({
      clientes: "/clientes",
      socios: "/members",
      "caja-movimientos": "/caja/movimientos",
      captacion: "/captacion/lista",
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

import { describe, expect, it } from "vitest";
import { LISTAS } from "./registro";

describe("registro de listas", () => {
  it("tiene las tres listas de la etapa con su módulo", () => {
    expect(Object.fromEntries(Object.entries(LISTAS).map(([k, v]) => [k, v.moduleKey]))).toEqual({
      clientes: "clients",
      socios: "members",
      "caja-movimientos": "cash",
    });
  });
});

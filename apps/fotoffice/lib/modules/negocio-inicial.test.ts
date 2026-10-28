import { describe, expect, it } from "vitest";
import { modulosInicialesDeNegocio } from "./negocio-inicial";
import { getModuleDefinition } from "./registry";

describe("módulos con los que nace Tu negocio", () => {
  const keys = modulosInicialesDeNegocio();

  it("trae el circuito completo de venta y entrega", () => {
    for (const k of ["service-leads", "quotes", "orders", "projects", "gallery", "contracts", "agenda", "clients", "cash"]) {
      expect(keys).toContain(k);
    }
  });

  it("trae Fotolibros y Foto carnet, que ahora son módulos propios", () => {
    expect(keys).toContain("fotolibros");
    expect(keys).toContain("foto-carnet");
  });

  it("no trae nada institucional ni Comunicación", () => {
    for (const k of keys) expect(getModuleDefinition(k)?.family).toMatch(/^(base|negocio)$/);
    expect(keys).not.toContain("members");
    expect(keys).not.toContain("communications");
  });

  it("lo que cobra comisión no se enciende solo: se pide la activación", () => {
    expect(keys).not.toContain("digitalizacion");
    for (const k of keys) expect(getModuleDefinition(k)?.platformFee).toBeFalsy();
  });

  it("cada módulo con lo que necesita: ninguno depende de algo que no nace encendido", () => {
    for (const k of keys) {
      for (const d of getModuleDefinition(k)?.dependsOn ?? []) expect(keys).toContain(d);
    }
  });
});

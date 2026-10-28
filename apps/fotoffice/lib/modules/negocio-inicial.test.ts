import { describe, expect, it } from "vitest";
import { modulosInicialesDeNegocio } from "./negocio-inicial";
import { getModuleDefinition } from "./registry";

describe("módulos con los que nace Tu negocio (plan Base)", () => {
  const keys = modulosInicialesDeNegocio();

  it("trae el circuito completo de venta y entrega, y Fotolibros", () => {
    for (const k of ["service-leads", "quotes", "orders", "projects", "gallery", "contracts", "agenda", "clients", "cash", "website", "fotolibros"]) {
      expect(keys).toContain(k);
    }
  });

  it("no trae lo que el plan Base deja con candado", () => {
    for (const k of ["foto-carnet", "sales", "equipo", "whatsapp-inbox", "store", "print-orders", "invoicing", "reports", "digitalizacion"]) {
      expect(keys).not.toContain(k);
    }
  });

  it("no trae nada institucional, ni Comunicación, ni lo que cobra comisión", () => {
    for (const k of keys) {
      const m = getModuleDefinition(k);
      expect(m?.status).toBe("AVAILABLE");
      expect(m?.family).toMatch(/^(base|negocio)$/);
      expect(m?.platformFee).toBeFalsy();
    }
    expect(keys).not.toContain("communications");
  });

  it("cada módulo con lo que necesita: ninguno depende de algo que no nace encendido", () => {
    for (const k of keys) {
      for (const d of getModuleDefinition(k)?.dependsOn ?? []) expect(keys).toContain(d);
    }
  });
});

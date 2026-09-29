import { describe, expect, it } from "vitest";
import { TIPOS } from "@/lib/landing/tipos";
import { getModuleDefinition } from "./registry";
import { ordenDeFamilias, paqueteSugerido } from "./suggested";

describe("paqueteSugerido", () => {
  it("cada tipo produce sólo módulos disponibles y sin comisión", () => {
    for (const t of TIPOS) {
      for (const k of paqueteSugerido(t.id)) {
        const m = getModuleDefinition(k)!;
        expect(m.status).toBe("AVAILABLE");
        expect(m.platformFee).not.toBe(true);
      }
    }
  });
  it("estudio incluye caja y clientes", () => {
    const p = paqueteSugerido("estudio");
    expect(p).toContain("cash");
    expect(p).toContain("clients");
  });
  it("sociedad incluye socios aunque cuotas quede afuera por comisión", () => {
    const p = paqueteSugerido("sociedad");
    expect(p).toContain("members");
    expect(p).not.toContain("membership-dues");
  });
  it("tipo desconocido: paquete vacío", () => {
    expect(paqueteSugerido("xyz")).toEqual([]);
  });
});

describe("ordenDeFamilias", () => {
  it("estudio empieza por negocio; sociedad por institución", () => {
    expect(ordenDeFamilias("estudio")[0]).toBe("negocio");
    expect(ordenDeFamilias("sociedad")[0]).toBe("institucion");
  });
  it("siempre devuelve las seis familias", () => {
    expect(new Set(ordenDeFamilias(null)).size).toBe(6);
  });
});

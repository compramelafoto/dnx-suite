import { describe, expect, it } from "vitest";
import { BASE_DEL_SISTEMA, EN_CONSTRUCCION, MODULOS_DISPONIBLES } from "./catalogo";
import { TIPOS, clavesDe } from "./tipos";

const CLAVES_DEL_CATALOGO = new Set(
  [...MODULOS_DISPONIBLES, ...BASE_DEL_SISTEMA].map((m) => m.key),
);
const CUADROS_SIN_REVELAR = new Set(EN_CONSTRUCCION.map((m) => m.cuadro));

/**
 * La respuesta a "¿qué sos?" es lo único que ve alguien que recién llega. Si recomienda un
 * módulo que no existe, la primera impresión del sistema es una promesa incumplida.
 */
describe("tipos de organización", () => {
  it("recomiendan solo módulos que están en el catálogo", () => {
    for (const tipo of TIPOS) {
      const inventadas = clavesDe(tipo).filter((k) => !CLAVES_DEL_CATALOGO.has(k));
      expect(inventadas, tipo.label).toEqual([]);
    }
  });

  it("destacan exactamente tres, que es lo que alguien retiene", () => {
    for (const tipo of TIPOS) {
      expect(tipo.destacados.length, tipo.label).toBe(3);
    }
  });

  it("no repiten un módulo entre los destacados y el resto", () => {
    for (const tipo of TIPOS) {
      const claves = clavesDe(tipo);
      expect(new Set(claves).size, tipo.label).toBe(claves.length);
    }
  });

  it("cada motivo está escrito para ese caso y no es una etiqueta suelta", () => {
    for (const tipo of TIPOS) {
      for (const d of tipo.destacados) {
        expect(d.porque.length, `${tipo.label} / ${d.key}`).toBeGreaterThan(60);
      }
    }
  });

  it("lo que le viene a cada uno es un cuadro sin revelar de verdad", () => {
    for (const tipo of TIPOS) {
      expect(CUADROS_SIN_REVELAR.has(tipo.proximo), tipo.label).toBe(true);
    }
  });

  it("no hay dos tipos con el mismo identificador", () => {
    const ids = TIPOS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

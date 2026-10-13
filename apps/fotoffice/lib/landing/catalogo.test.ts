import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY, listAvailableModuleKeys } from "@/lib/modules/registry";
import { MODULOS_DISPONIBLES, BASE_DEL_SISTEMA, MODULOS_DE_LA_SUITE } from "./catalogo";

/**
 * La portada es lo único que ve alguien que todavía no entró. Si un módulo nuevo se enciende y
 * nadie lo cuenta ahí, existe para el sistema y no para el que lo tendría que contratar.
 */
describe("catálogo de la portada", () => {
  it("cuenta todos los módulos que hoy se pueden encender", () => {
    const contados = new Set(MODULOS_DISPONIBLES.map((m) => m.key));
    const faltantes = listAvailableModuleKeys().filter((k) => !contados.has(k));
    expect(faltantes).toEqual([]);
  });

  it("no anuncia módulos que no existen o que todavía no están implementados", () => {
    const disponibles = new Set(listAvailableModuleKeys());
    const inventados = MODULOS_DISPONIBLES.filter((m) => !disponibles.has(m.key)).map((m) => m.key);
    expect(inventados).toEqual([]);
  });

  it("no repite un cuadro entre módulos y base del sistema", () => {
    const cuadros = [...MODULOS_DISPONIBLES, ...BASE_DEL_SISTEMA, ...MODULOS_DE_LA_SUITE].map((m) => m.cuadro);
    expect(new Set(cuadros).size).toBe(cuadros.length);
  });

  it("la base del sistema no usa claves del registro de módulos", () => {
    const delRegistro = new Set(MODULE_REGISTRY.map((m) => m.key));
    const chocan = BASE_DEL_SISTEMA.filter((m) => delRegistro.has(m.key)).map((m) => m.key);
    expect(chocan).toEqual([]);
  });

  it("lo que viene de otras aplicaciones de la suite no se hace pasar por un módulo de FOTOFFICE", () => {
    const delRegistro = new Set(MODULE_REGISTRY.map((m) => m.key));
    const base = new Set(BASE_DEL_SISTEMA.map((m) => m.key));
    const chocan = MODULOS_DE_LA_SUITE.filter((m) => delRegistro.has(m.key) || base.has(m.key)).map((m) => m.key);
    expect(chocan).toEqual([]);
    for (const m of MODULOS_DE_LA_SUITE) expect(m.app.length, m.key).toBeGreaterThan(0);
  });
});

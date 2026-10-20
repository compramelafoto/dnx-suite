import { describe, expect, it } from "vitest";
import { BASE_DEL_SISTEMA, MODULOS_DE_LA_SUITE, MODULOS_DISPONIBLES } from "./catalogo";
import { PUNTOS_INSTITUCIONALES } from "./instituciones";
import { SELECCION_INSTITUCIONES } from "./seleccion-instituciones";
import { tipoPorId } from "./tipos";

const CATALOGO = new Set([...MODULOS_DISPONIBLES, ...BASE_DEL_SISTEMA, ...MODULOS_DE_LA_SUITE].map((m) => m.key));

/**
 * La propuesta a una institución se manda por correo con un enlace. Si un punto o el enlace
 * apuntan a un módulo que no existe, lo que se promete y lo que se ve dejan de coincidir.
 */
describe("propuesta para instituciones", () => {
  it("cada punto se apoya en módulos del catálogo", () => {
    for (const p of PUNTOS_INSTITUCIONALES) {
      expect(p.claves.filter((k) => !CATALOGO.has(k)), p.id).toEqual([]);
    }
  });

  it("el enlace del correo lleva sólo claves reales y el tipo existe", () => {
    expect(tipoPorId(SELECCION_INSTITUCIONES.tipoId)).toBeDefined();
    expect(SELECCION_INSTITUCIONES.modulos.filter((k) => !CATALOGO.has(k))).toEqual([]);
  });

  it("el enlace incluye lo que se le promete a la institución, concursos y muestras incluidos", () => {
    for (const k of ["members", "membership-dues", "carnets", "raffles", "sponsors", "concursos", "muestras"]) {
      expect(SELECCION_INSTITUCIONES.modulos).toContain(k);
    }
  });
});

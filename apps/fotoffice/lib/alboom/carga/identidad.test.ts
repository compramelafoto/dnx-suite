import { describe, expect, it } from "vitest";
import { esCorreoDeRelleno, nombreCifrado, nombrePersona, nombresCompatibles } from "./identidad";

const n = (a: string, b = "", e = "") => nombrePersona(a, b, e);

describe("¿la misma persona?", () => {
  it("correos de relleno, de ejemplo y del propio estudio", () => {
    for (const m of [
      "sincorreo@gmail.com", "sincorreo2@hotmail.com", "noemail@gmail.com", "no@no.com", "x@x.com", "sin@mail.com", "notiene@gmail.com",
      "ejemplo@gmail.com", "ana@example.com", "test@estudio.com", "1234@gmail.com", "0@0.com", "nn@gmail.com", "notengo@hotmail.com",
      "sinemail@gmail.com", "nomail@gmail.com", "ninguno@yahoo.com", "x@x.com.ar", "a@a.com",
    ]) {
      expect(esCorreoDeRelleno(m), m).toBe(true);
    }
    expect(esCorreoDeRelleno("hola@dnxestudio.com", new Set(["hola@dnxestudio.com"]))).toBe(true);
    for (const m of ["ana.gomez@gmail.com", "nora@gmail.com", "familiaperez@gmail.com", "xavier@gmail.com"]) expect(esCorreoDeRelleno(m), m).toBe(false);
  });

  it("regla estricta de nombres: el corto (≥2 palabras, sin partículas) contenido en el largo", () => {
    expect(nombresCompatibles(n("María", "de la Cruz"), n("Juan", "de la Cruz"))).toBe(false);
    expect(nombresCompatibles(n("María José", "Pérez"), n("María Laura", "Pérez"))).toBe(false);
    expect(nombresCompatibles(n("Juan Carlos", "Pérez"), n("Juan Martín", "Pérez"))).toBe(false);
    expect(nombresCompatibles(n("Juan", "Pérez"), n("Juan Carlos", "Pérez"))).toBe(true);
    expect(nombresCompatibles(n("Pérez", "Juan"), n("Juan", "Pérez"))).toBe(true);
    expect(nombresCompatibles(n("LUCÍA", "FERNÁNDEZ"), n("lucia", "fernandez"))).toBe(true);
    expect(nombresCompatibles(n("Lucía", "Fernández de Paz"), n("Lucía", "Fernández"))).toBe(true);
    expect(nombresCompatibles(n("Juan"), n("Juan"))).toBe(false);
    expect(nombresCompatibles(n("Juan"), n("Juan", "Pérez"))).toBe(false);
    expect(nombresCompatibles(n("Lu", "Fernández"), n("Lucía", "Fernández"))).toBe(false);
    expect(nombresCompatibles(n(""), n("Lucía", "Paz"))).toBe(false);
  });

  it("cifrado con sal: compara igual sin guardar el nombre", () => {
    const a = nombreCifrado(n("Lucía", "Fernández"), "s1");
    expect(nombresCompatibles(a, nombreCifrado(n("Lucia", "Fernandez"), "s1"))).toBe(true);
    expect(nombresCompatibles(a, nombreCifrado(n("Juan", "Pérez"), "s1"))).toBe(false);
    expect(nombresCompatibles(a, nombreCifrado(n("Lucia", "Fernandez"), "otra-sal"))).toBe(false);
    expect(JSON.stringify(a)).not.toMatch(/luc|fern/);
  });
});

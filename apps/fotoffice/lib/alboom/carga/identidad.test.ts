import { describe, expect, it } from "vitest";
import { esCorreoDeRelleno, nombreCifrado, nombrePersona, nombresCompatibles } from "./identidad";

const n = (a: string, b = "", e = "") => nombrePersona(a, b, e);

describe("¿la misma persona?", () => {
  it("correos de relleno, de ejemplo y del propio estudio", () => {
    for (const m of ["sincorreo@gmail.com", "sincorreo2@hotmail.com", "noemail@gmail.com", "no@no.com", "x@x.com", "sin@mail.com", "notiene@gmail.com", "ejemplo@gmail.com", "ana@example.com", "test@estudio.com"]) {
      expect(esCorreoDeRelleno(m), m).toBe(true);
    }
    expect(esCorreoDeRelleno("hola@dnxestudio.com", new Set(["hola@dnxestudio.com"]))).toBe(true);
    for (const m of ["ana.gomez@gmail.com", "nora@gmail.com", "familiaperez@gmail.com", "xavier@gmail.com"]) expect(esCorreoDeRelleno(m), m).toBe(false);
  });

  it("nombres compatibles: mismo nombre, uno contiene al otro, o se parecen", () => {
    expect(nombresCompatibles(n("Lucía", "Fernández"), n("LUCIA", "fernandez"))).toBe(true);
    expect(nombresCompatibles(n("Lucía", "Fernández de Paz"), n("Lucía", "Fernández"))).toBe(true);
    expect(nombresCompatibles(n("María Lucía", "Fernández"), n("Lucía", "Fernández"))).toBe(true);
    expect(nombresCompatibles(n("Juan", "Pérez"), n("María", "Gómez"))).toBe(false);
    expect(nombresCompatibles(n("Juan", "Pérez"), n("María", "Pérez"))).toBe(false);
    expect(nombresCompatibles(n("Lu", "Fernández"), n("Lucía", "Fernández"))).toBe(false);
    expect(nombresCompatibles(n(""), n("Lucía"))).toBe(false);
  });

  it("cifrado con sal: compara igual sin guardar el nombre", () => {
    const a = nombreCifrado(n("Lucía", "Fernández"), "s1");
    expect(nombresCompatibles(a, nombreCifrado(n("Lucia", "Fernandez"), "s1"))).toBe(true);
    expect(nombresCompatibles(a, nombreCifrado(n("Juan", "Pérez"), "s1"))).toBe(false);
    expect(JSON.stringify(a)).not.toMatch(/luc|fern/);
  });
});

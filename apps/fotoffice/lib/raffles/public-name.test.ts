import { describe, expect, it } from "vitest";
import { nombrePublico } from "./public-name";

describe("nombrePublico", () => {
  it("nombre completo e inicial del apellido", () => {
    expect(nombrePublico("Daniel Andrés", "Cuart", "Daniel Andrés Cuart")).toBe("Daniel Andrés C.");
  });

  it("con apellido compuesto, sólo la primera inicial", () => {
    expect(nombrePublico("Ana", "de la Torre", "Ana de la Torre")).toBe("Ana D.");
  });

  it("sin ficha, usa la instantánea del padrón", () => {
    expect(nombrePublico(null, null, "María José Pérez")).toBe("María José P.");
    expect(nombrePublico(undefined, undefined, "Cher")).toBe("Cher");
  });

  it("nunca devuelve el apellido completo", () => {
    expect(nombrePublico("Juan", "Rodríguez", "Juan Rodríguez")).not.toContain("Rodríguez");
  });
});

import { describe, expect, it } from "vitest";
import { newSlug, slugify } from "./slug";

describe("slug", () => {
  it("saca tildes, signos y espacios", () => expect(slugify("  Miradas del Litoral: ¡Año 2026! ")).toBe("miradas-del-litoral-ano-2026"));
  it("corta en 60 caracteres sin guión al final", () => {
    const s = slugify("a ".repeat(80));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
  it("un título sin letras usa 'actividad'", () => expect(slugify("¡¡¡")).toBe("actividad"));
  it("newSlug agrega un sufijo para no chocar", () => expect(newSlug("Mi muestra", () => "x7k2q9")).toBe("mi-muestra-x7k2q9"));
});

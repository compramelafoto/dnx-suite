import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOTOS, srcFoto, zona, type NombreFoto } from "./fotos";

const PUBLICO = path.join(__dirname, "..", "..", "public");

describe("fotos del sitio", () => {
  const nombres = Object.keys(FOTOS) as NombreFoto[];

  it.each(nombres)("«%s» tiene las dos versiones en public/fotos y un texto alternativo", (n) => {
    expect(existsSync(path.join(PUBLICO, srcFoto(n)))).toBe(true);
    expect(existsSync(path.join(PUBLICO, srcFoto(n, true)))).toBe(true);
    expect(FOTOS[n].alt.length).toBeGreaterThan(20);
  });

  it("arma la ruta grande y la chica", () => {
    expect(srcFoto("lentes")).toBe("/fotos/lentes.webp");
    expect(srcFoto("lentes", true)).toBe("/fotos/lentes-720.webp");
  });
});

describe("zona", () => {
  it("junta ciudad y provincia", () => {
    expect(zona("Rosario", "Santa Fe")).toBe("Rosario, Santa Fe");
  });

  it("sin ciudad muestra sólo la provincia", () => {
    expect(zona("  ", "Córdoba")).toBe("Córdoba");
    expect(zona(null, "Córdoba")).toBe("Córdoba");
  });
});

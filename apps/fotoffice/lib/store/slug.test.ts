import { describe, expect, it } from "vitest";
import { MAX_SLUG_LENGTH, slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("minúsculas y guiones", () => {
    expect(slugify("Remera Oficial SFPR")).toBe("remera-oficial-sfpr");
  });

  it("saca acentos y la eñe", () => {
    expect(slugify("Ñandú")).toBe("nandu");
    expect(slugify("Gorra Edición Única")).toBe("gorra-edicion-unica");
  });

  it("lo que no es letra ni número se vuelve un solo guion, sin guiones en las puntas", () => {
    expect(slugify("  Taza   (blanca) / 350ml!! ")).toBe("taza-blanca-350ml");
    expect(slugify("--Hola--")).toBe("hola");
  });

  it("corta en 80 caracteres sin dejar un guion colgando", () => {
    const largo = slugify(`${"a".repeat(79)} b c d`);
    expect(largo.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(largo.endsWith("-")).toBe(false);
    expect(largo).toBe("a".repeat(79));
  });

  it("un nombre sin letras ni números da vacío", () => {
    expect(slugify("¡¿?!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("si está libre, queda igual", () => {
    expect(uniqueSlug("remera", new Set())).toBe("remera");
  });

  it("si choca, agrega -2, -3, …", () => {
    expect(uniqueSlug("remera", new Set(["remera"]))).toBe("remera-2");
    expect(uniqueSlug("remera", new Set(["remera", "remera-2"]))).toBe("remera-3");
  });

  it("una base vacía usa 'producto'", () => {
    expect(uniqueSlug("", new Set())).toBe("producto");
    expect(uniqueSlug("", new Set(["producto"]))).toBe("producto-2");
  });

  it("con el sufijo no pasa de 80 caracteres", () => {
    const base = "a".repeat(MAX_SLUG_LENGTH);
    const r = uniqueSlug(base, new Set([base]));
    expect(r.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(r.endsWith("-2")).toBe(true);
  });
});

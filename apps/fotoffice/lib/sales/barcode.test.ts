import { describe, expect, it } from "vitest";
import { looksLikeBarcode, normalizeBarcode } from "./barcode";

describe("normalizeBarcode", () => {
  it("saca espacios y guiones que el lector o la persona puedan meter", () => {
    expect(normalizeBarcode(" 779-1234 567890 ")).toBe("7791234567890");
  });

  it("un código vacío es null, no cadena vacía", () => {
    expect(normalizeBarcode("   ")).toBeNull();
    expect(normalizeBarcode("")).toBeNull();
  });

  it("rechaza lo que tiene letras: un código de barras es numérico", () => {
    expect(normalizeBarcode("TRP-12")).toBeNull();
  });

  it("conserva los ceros de la izquierda, que son parte del código", () => {
    expect(normalizeBarcode("0012345678905")).toBe("0012345678905");
  });
});

describe("looksLikeBarcode", () => {
  it("reconoce un EAN-13", () => {
    expect(looksLikeBarcode("7791234567890")).toBe(true);
  });

  it("reconoce un EAN-8 y un UPC-A", () => {
    expect(looksLikeBarcode("12345670")).toBe(true);
    expect(looksLikeBarcode("012345678905")).toBe(true);
  });

  it("un código interno inventado no es un código de barras", () => {
    expect(looksLikeBarcode("TRP-12")).toBe(false);
  });

  it("pocos dígitos tampoco: '25' es una cantidad, no un código", () => {
    expect(looksLikeBarcode("25")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseAmountToMinor } from "./amount";

function minor(raw: string): number {
  const r = parseAmountToMinor(raw);
  if (!r.ok) throw new Error(`esperaba que «${raw}» fuera válido: ${r.error}`);
  return r.minor;
}

describe("parseAmountToMinor", () => {
  it("un entero sin separadores son pesos enteros", () => {
    expect(minor("1500")).toBe(150000);
    expect(minor("15000")).toBe(1500000);
  });

  it("dos dígitos después del separador son centavos", () => {
    expect(minor("15000.50")).toBe(1500050);
    expect(minor("15000,50")).toBe(1500050);
  });

  it("tres dígitos después del separador son miles", () => {
    expect(minor("15.000")).toBe(1500000);
    expect(minor("15,000")).toBe(1500000);
  });

  it("interpreta el formato argentino completo", () => {
    expect(minor("1.234.567,89")).toBe(123456789);
  });

  it("interpreta también el formato inglés completo", () => {
    expect(minor("1,234,567.89")).toBe(123456789);
  });

  it("tolera espacios sueltos", () => {
    expect(minor(" 15 000,50 ")).toBe(1500050);
  });

  it("rechaza lo ambiguo en vez de adivinar", () => {
    // Cuatro decimales no son ni centavos ni miles: se rechaza.
    expect(parseAmountToMinor("15.0000").ok).toBe(false);
    expect(parseAmountToMinor("15.1").ok).toBe(false);
  });

  it("rechaza el símbolo de moneda en lugar de limpiarlo en silencio", () => {
    const r = parseAmountToMinor("$15000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("sin símbolos");
  });

  it("rechaza el vacío, el cero y los negativos", () => {
    expect(parseAmountToMinor("").ok).toBe(false);
    expect(parseAmountToMinor("0").ok).toBe(false);
    expect(parseAmountToMinor("0,00").ok).toBe(false);
    expect(parseAmountToMinor("-1500").ok).toBe(false);
  });

  it("rechaza texto que no es un número", () => {
    expect(parseAmountToMinor("mil quinientos").ok).toBe(false);
    expect(parseAmountToMinor("15000 pesos").ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildFeeBreakdown } from "./breakdown";

describe("buildFeeBreakdown", () => {
  it("desglosa 10.000 al 5%", () => {
    const b = buildFeeBreakdown("10000", 500);
    expect(b?.feeLine).toBe("Fee de plataforma (5%): $500,00");
    expect(b?.netLine).toBe("Recibís aproximadamente $9.500,00.");
    expect(b?.hasFee).toBe(true);
  });

  /**
   * "Aproximadamente" y la advertencia no son adorno: impuestos y comisión de MercadoPago
   * dependen de la condición fiscal de cada institución. Prometer un neto exacto sería
   * mentirle al dueño del workspace.
   */
  it("siempre aclara que faltan impuestos y MercadoPago", () => {
    const b = buildFeeBreakdown("10000", 500);
    expect(b?.netLine).toMatch(/aproximadamente/i);
    expect(b?.warningLine).toMatch(/impuestos/i);
    expect(b?.warningLine).toMatch(/MercadoPago/i);
  });

  it("con comisión cero lo dice y no muestra línea de fee", () => {
    const b = buildFeeBreakdown("10000", 0);
    expect(b?.hasFee).toBe(false);
    expect(b?.feeLine).toBeNull();
    expect(b?.netLine).toBe("Sin comisión de plataforma. Recibís aproximadamente $10.000,00.");
  });

  it("mantiene la advertencia aunque la comisión sea cero", () => {
    const b = buildFeeBreakdown("10000", 0);
    expect(b?.warningLine).toMatch(/impuestos/i);
  });

  it.each(["", "  ", "0", "-5", "abc", "NaN"])("con importe inválido (%s) devuelve null", (v) => {
    expect(buildFeeBreakdown(v, 500)).toBeNull();
  });

  it("acepta coma decimal", () => {
    const b = buildFeeBreakdown("1234,56", 500);
    expect(b?.feeLine).toBe("Fee de plataforma (5%): $61,73");
  });

  it("acepta número además de string", () => {
    const b = buildFeeBreakdown(10000, 500);
    expect(b?.netLine).toBe("Recibís aproximadamente $9.500,00.");
  });

  it("usa el porcentaje configurado, no uno fijo", () => {
    const b = buildFeeBreakdown("10000", 1250);
    expect(b?.feeLine).toBe("Fee de plataforma (12,5%): $1.250,00");
    expect(b?.netLine).toBe("Recibís aproximadamente $8.750,00.");
  });

  /** El desglose que se le muestra al dueño tiene que cerrar contra lo que va a cobrar. */
  it("fee + neto mostrados suman el total", () => {
    const b = buildFeeBreakdown("999.99", 733);
    expect(b?.feeArs.plus(b.netArs).toFixed(2)).toBe("999.99");
  });
});

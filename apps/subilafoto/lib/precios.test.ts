import { describe, expect, test } from "vitest";
import { calcularPrecios, formatearPesos } from "./precios";

describe("precio del evento y del adicional de descarga", () => {
  test("con el 15% sugerido, un evento de $120.000 suma $18.000 de descarga", () => {
    const p = calcularPrecios({
      basePriceCents: 12_000_000,
      downloadMode: "PERCENT",
      downloadPercentBps: 1500,
      downloadPriceCents: null,
    });

    expect(p.baseCents).toBe(12_000_000);
    expect(p.adicionalCents).toBe(1_800_000);
    expect(p.totalCents).toBe(13_800_000);
  });

  test("con precio fijo, el adicional no depende del precio del evento", () => {
    const p = calcularPrecios({
      basePriceCents: 12_000_000,
      downloadMode: "FIXED",
      downloadPercentBps: null,
      downloadPriceCents: 2_500_000,
    });

    expect(p.adicionalCents).toBe(2_500_000);
    expect(p.totalCents).toBe(14_500_000);
  });

  test("si la descarga viene incluida, no hay adicional que cobrar", () => {
    const p = calcularPrecios({
      basePriceCents: 12_000_000,
      downloadMode: "INCLUDED",
      downloadPercentBps: null,
      downloadPriceCents: null,
    });

    expect(p.adicionalCents).toBeNull();
    expect(p.totalCents).toBe(12_000_000);
  });

  test("el adicional se redondea al centavo, nunca queda una fracción", () => {
    // 12,5% de $999,99 da 124,99875 pesos: tiene que quedar un entero de centavos.
    const p = calcularPrecios({
      basePriceCents: 99_999,
      downloadMode: "PERCENT",
      downloadPercentBps: 1250,
      downloadPriceCents: null,
    });

    expect(Number.isInteger(p.adicionalCents)).toBe(true);
    expect(p.adicionalCents).toBe(12_500);
  });

  test("un porcentaje sin definir no se convierte en descarga gratis", () => {
    expect(() =>
      calcularPrecios({
        basePriceCents: 12_000_000,
        downloadMode: "PERCENT",
        downloadPercentBps: null,
        downloadPriceCents: null,
      }),
    ).toThrow(/porcentaje/i);
  });

  test("los pesos se muestran como los lee una persona", () => {
    expect(formatearPesos(12_000_000)).toBe("$ 120.000");
    expect(formatearPesos(99_999)).toBe("$ 999,99");
  });
});

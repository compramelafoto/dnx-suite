import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import {
  DEFAULT_PLATFORM_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
  formatFeeBpsAsPercent,
  isValidFeeBps,
  resolvePlatformFeeBps,
  splitByPlatformFee, splitMinorByPlatformFee } from "./fee";

const money = (v: string) => new Prisma.Decimal(v);

describe("resolvePlatformFeeBps", () => {
  it("sin configuración devuelve el 5% por defecto", () => {
    expect(DEFAULT_PLATFORM_FEE_BPS).toBe(500);
    expect(resolvePlatformFeeBps(null)).toBe(500);
    expect(resolvePlatformFeeBps(undefined)).toBe(500);
  });

  it("respeta el valor configurado", () => {
    expect(resolvePlatformFeeBps(1200)).toBe(1200);
  });

  /** Comisión cero es un valor legítimo, no "sin configurar". */
  it("cero es un valor válido y no cae al default", () => {
    expect(resolvePlatformFeeBps(0)).toBe(0);
  });

  it("un valor fuera de rango cae al default en vez de propagar basura", () => {
    expect(resolvePlatformFeeBps(-1)).toBe(500);
    expect(resolvePlatformFeeBps(10001)).toBe(500);
    expect(resolvePlatformFeeBps(1.5)).toBe(500);
    expect(resolvePlatformFeeBps(Number.NaN)).toBe(500);
  });
});

describe("isValidFeeBps", () => {
  it.each([
    [0, true],
    [500, true],
    [MAX_PLATFORM_FEE_BPS, true],
    [-1, false],
    [10001, false],
    [1.5, false],
    ["500", false],
    [null, false],
  ])("%s -> %s", (value, expected) => {
    expect(isValidFeeBps(value)).toBe(expected);
  });
});

describe("formatFeeBpsAsPercent", () => {
  it.each([
    [500, "5%"],
    [0, "0%"],
    [1050, "10,5%"],
    [10000, "100%"],
  ])("%s bps -> %s", (bps, expected) => {
    expect(formatFeeBpsAsPercent(bps)).toBe(expected);
  });
});

describe("splitByPlatformFee", () => {
  it("parte 10.000 al 5% en 500 de fee y 9.500 neto", () => {
    const r = splitByPlatformFee(money("10000"), 500);
    expect(r.fee.toFixed(2)).toBe("500.00");
    expect(r.net.toFixed(2)).toBe("9500.00");
    expect(r.feeBps).toBe(500);
  });

  it("con comisión cero el neto es el total", () => {
    const r = splitByPlatformFee(money("10000"), 0);
    expect(r.fee.toFixed(2)).toBe("0.00");
    expect(r.net.toFixed(2)).toBe("10000.00");
  });

  /**
   * El invariante que no se puede romper: lo que paga el socio es exactamente
   * lo que se reparte. Si fee + net no da total, alguien pierde o gana plata.
   */
  it.each(["0", "0.01", "1", "33.33", "10000", "12345.67", "999999.99"])(
    "fee + net === total para %s en varios porcentajes",
    (amount) => {
      for (const bps of [0, 1, 250, 500, 1234, 9999, 10000]) {
        const r = splitByPlatformFee(money(amount), bps);
        expect(r.fee.plus(r.net).toFixed(2)).toBe(money(amount).toFixed(2));
      }
    },
  );

  it("redondea el fee a 2 decimales con ROUND_HALF_UP", () => {
    // 33.33 * 5% = 1.6665 -> 1.67
    const r = splitByPlatformFee(money("33.33"), 500);
    expect(r.fee.toFixed(2)).toBe("1.67");
    expect(r.net.toFixed(2)).toBe("31.66");
  });

  it("nunca produce un neto negativo", () => {
    const r = splitByPlatformFee(money("10"), 10000);
    expect(r.fee.toFixed(2)).toBe("10.00");
    expect(r.net.toFixed(2)).toBe("0.00");
  });

  it("un bps inválido cae al default en vez de calcular cualquier cosa", () => {
    const r = splitByPlatformFee(money("10000"), -5);
    expect(r.feeBps).toBe(500);
    expect(r.fee.toFixed(2)).toBe("500.00");
  });
});

describe("splitMinorByPlatformFee", () => {
  it("el 5% de $47.000 son $2.350", () => {
    const r = splitMinorByPlatformFee(4700000, 500);
    expect(r.feeMinor).toBe(235000);
    expect(r.netMinor).toBe(4465000);
  });

  it("la comisión y el neto siempre suman el total", () => {
    for (const total of [1, 7, 99, 100, 4700000, 123456789, 999999999]) {
      for (const bps of [0, 1, 250, 500, 1234, 9999, 10000]) {
        const r = splitMinorByPlatformFee(total, bps);
        expect(r.feeMinor + r.netMinor).toBe(total);
        expect(r.feeMinor).toBeGreaterThanOrEqual(0);
        expect(r.netMinor).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("sin comisión, el neto es el total", () => {
    expect(splitMinorByPlatformFee(4700000, 0)).toMatchObject({ feeMinor: 0, netMinor: 4700000 });
  });

  it("un total inválido no inventa importes", () => {
    expect(splitMinorByPlatformFee(-1, 500).totalMinor).toBe(0);
    expect(splitMinorByPlatformFee(10.5, 500).totalMinor).toBe(0);
  });

  it("redondea a la mitad hacia arriba, igual que la versión con Decimal", () => {
    // 5% de 10 centavos = 0,5 centavos → 1
    expect(splitMinorByPlatformFee(10, 500).feeMinor).toBe(1);
  });
});

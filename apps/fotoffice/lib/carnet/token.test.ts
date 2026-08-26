import { describe, expect, it } from "vitest";
import {
  cardTokenMatches,
  formatCardNumber,
  generateCardToken,
  hashCardToken,
  looksLikeCardToken,
  TOKEN_LENGTH,
} from "./token";

describe("generateCardToken", () => {
  it("tiene el largo declarado", () => {
    expect(generateCardToken()).toHaveLength(TOKEN_LENGTH);
  });

  it("no repite: mil tokens dan mil valores distintos", () => {
    const vistos = new Set(Array.from({ length: 1000 }, () => generateCardToken()));
    expect(vistos.size).toBe(1000);
  });

  it("no usa los caracteres que de verdad se confunden al dictarlos", () => {
    // Un socio puede tener que leer su enlace por teléfono. Las confusiones reales son
    // 0 con O y 1 con I. La L mayúscula no se confunde con nada, y sacarla dejaría el
    // alfabeto en 31 letras, que ya no divide a 256 y metería sesgo en el azar.
    const muestra = Array.from({ length: 200 }, () => generateCardToken()).join("");
    expect(muestra).not.toMatch(/[01OI]/);
  });

  it("el alfabeto divide a 256, para que el azar no quede sesgado", () => {
    // Con 32 letras el módulo reparte parejo. Con 31, las primeras letras saldrían más.
    const cuentas = new Map<string, number>();
    const muestra = Array.from({ length: 2000 }, () => generateCardToken()).join("");
    for (const c of muestra) cuentas.set(c, (cuentas.get(c) ?? 0) + 1);
    expect(cuentas.size).toBe(32);
    const valores = [...cuentas.values()];
    const esperado = muestra.length / 32;
    // Margen amplio: la prueba busca un sesgo estructural, no ruido estadístico.
    expect(Math.min(...valores)).toBeGreaterThan(esperado * 0.7);
    expect(Math.max(...valores)).toBeLessThan(esperado * 1.3);
  });
});

describe("hashCardToken", () => {
  it("el mismo token da siempre el mismo hash", () => {
    const t = generateCardToken();
    expect(hashCardToken(t)).toBe(hashCardToken(t));
    expect(hashCardToken(t)).toHaveLength(64);
  });

  it("el hash no contiene al token", () => {
    // Guardarlo hasheado es lo que impide fabricar carnets desde la base.
    const t = generateCardToken();
    expect(hashCardToken(t).toUpperCase()).not.toContain(t);
  });

  it("ignora mayúsculas y espacios de más", () => {
    const t = generateCardToken();
    expect(hashCardToken(`  ${t.toLowerCase()}  `)).toBe(hashCardToken(t));
  });
});

describe("cardTokenMatches", () => {
  it("reconoce el token correcto", () => {
    const t = generateCardToken();
    expect(cardTokenMatches(t, hashCardToken(t))).toBe(true);
  });

  it("rechaza otro token", () => {
    expect(cardTokenMatches(generateCardToken(), hashCardToken(generateCardToken()))).toBe(false);
  });

  it("un hash guardado corrupto no hace explotar nada", () => {
    expect(cardTokenMatches(generateCardToken(), "no soy un hash")).toBe(false);
    expect(cardTokenMatches(generateCardToken(), "")).toBe(false);
  });
});

describe("looksLikeCardToken", () => {
  it("acepta un token bien formado", () => {
    expect(looksLikeCardToken(generateCardToken())).toBe(true);
  });

  it("rechaza lo que no tiene la forma, sin ir a la base", () => {
    expect(looksLikeCardToken("")).toBe(false);
    expect(looksLikeCardToken("corto")).toBe(false);
    expect(looksLikeCardToken("A".repeat(TOKEN_LENGTH + 1))).toBe(false);
    // El 0 y la I no están en el alfabeto.
    expect(looksLikeCardToken("0".repeat(TOKEN_LENGTH))).toBe(false);
    expect(looksLikeCardToken("I".repeat(TOKEN_LENGTH))).toBe(false);
  });
});

describe("formatCardNumber", () => {
  it("arma el número con el año y la secuencia", () => {
    expect(formatCardNumber(2026, 412)).toBe("C-2026-0412");
    expect(formatCardNumber(2026, 1)).toBe("C-2026-0001");
    expect(formatCardNumber(2026, 12345)).toBe("C-2026-12345");
  });
});

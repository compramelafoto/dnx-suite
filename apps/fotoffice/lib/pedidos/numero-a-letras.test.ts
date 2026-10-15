import { describe, expect, it } from "vitest";
import { enteroEnLetras, importeEnLetras } from "./numero-a-letras";

describe("enteroEnLetras", () => {
  it.each([
    [0, "cero"],
    [1, "uno"],
    [15, "quince"],
    [16, "dieciséis"],
    [21, "veintiuno"],
    [22, "veintidós"],
    [30, "treinta"],
    [31, "treinta y uno"],
    [99, "noventa y nueve"],
    [100, "cien"],
    [101, "ciento uno"],
    [115, "ciento quince"],
    [500, "quinientos"],
    [999, "novecientos noventa y nueve"],
    [1000, "mil"],
    [1001, "mil uno"],
    [2000, "dos mil"],
    [21_000, "veintiún mil"],
    [31_000, "treinta y un mil"],
    [100_000, "cien mil"],
    [101_000, "ciento un mil"],
    [120_000, "ciento veinte mil"],
    [1_000_000, "un millón"],
    [2_000_000, "dos millones"],
    [21_000_000, "veintiún millones"],
    [1_500_000, "un millón quinientos mil"],
    [999_999_999, "novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve"],
  ])("%i → %s", (n, letras) => {
    expect(enteroEnLetras(n)).toBe(letras);
  });

  it("con apócope, el uno final queda un", () => {
    expect(enteroEnLetras(21, true)).toBe("veintiún");
    expect(enteroEnLetras(1001, true)).toBe("mil un");
    expect(enteroEnLetras(41, true)).toBe("cuarenta y un");
  });

  it("rechaza lo que no es un entero de 0 a 999.999.999", () => {
    expect(() => enteroEnLetras(1_000_000_000)).toThrow(RangeError);
    expect(() => enteroEnLetras(-1)).toThrow(RangeError);
    expect(() => enteroEnLetras(1.5)).toThrow(RangeError);
  });
});

describe("importeEnLetras", () => {
  it("lleva los centavos como NN/100", () => {
    expect(importeEnLetras(120_000.5)).toBe("ciento veinte mil pesos con 50/100");
    expect(importeEnLetras(120_000)).toBe("ciento veinte mil pesos con 00/100");
    expect(importeEnLetras(0.07)).toBe("cero pesos con 07/100");
    expect(importeEnLetras(1234.99)).toBe("mil doscientos treinta y cuatro pesos con 99/100");
  });

  it("concuerda con pesos: un peso, veintiún pesos, un millón de pesos", () => {
    expect(importeEnLetras(1)).toBe("un peso con 00/100");
    expect(importeEnLetras(21)).toBe("veintiún pesos con 00/100");
    expect(importeEnLetras(1_000_000)).toBe("un millón de pesos con 00/100");
    expect(importeEnLetras(3_000_000.1)).toBe("tres millones de pesos con 10/100");
    expect(importeEnLetras(1_000_001)).toBe("un millón un pesos con 00/100");
  });

  it("redondea el flotante a centavos", () => {
    expect(importeEnLetras(0.1 + 0.2)).toBe("cero pesos con 30/100");
    expect(importeEnLetras(19.999)).toBe("veinte pesos con 00/100");
  });

  it("rechaza negativos y lo que no es número", () => {
    expect(() => importeEnLetras(-1)).toThrow(RangeError);
    expect(() => importeEnLetras(Number.NaN)).toThrow(RangeError);
    expect(() => importeEnLetras(1_000_000_000)).toThrow(RangeError);
  });
});

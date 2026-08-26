import { describe, expect, it } from "vitest";
import { decimalArsToMinor, formatMinorArs, minorToDecimalString } from "./money";

describe("decimalArsToMinor", () => {
  it("convierte pesos con centavos a centavos enteros", () => {
    expect(decimalArsToMinor("47000.00")).toBe(4700000);
    expect(decimalArsToMinor("47000.5")).toBe(4700050);
    expect(decimalArsToMinor("47000.55")).toBe(4700055);
  });

  it("un importe sin parte decimal no pierde ni gana centavos", () => {
    expect(decimalArsToMinor("47000")).toBe(4700000);
    expect(decimalArsToMinor("0")).toBe(0);
  });

  it("no arrastra el error de la coma flotante", () => {
    // 0.1 + 0.2 en punto flotante da 0.30000000000000004. Acá se trabaja sobre el texto.
    expect(decimalArsToMinor("0.30")).toBe(30);
    expect(decimalArsToMinor("1234567.89")).toBe(123456789);
  });

  it("respeta el signo", () => {
    expect(decimalArsToMinor("-47000.25")).toBe(-4700025);
  });

  it("recorta a dos decimales sin redondear hacia arriba", () => {
    // La base guarda Decimal(12,2), así que un tercer decimal no debería existir. Si
    // apareciera, tomarlo por exceso inventaría plata que nadie debe.
    expect(decimalArsToMinor("10.999")).toBe(1099);
  });
});

describe("minorToDecimalString", () => {
  it("vuelve a texto con dos decimales", () => {
    expect(minorToDecimalString(4700000)).toBe("47000.00");
    expect(minorToDecimalString(4700055)).toBe("47000.55");
    expect(minorToDecimalString(5)).toBe("0.05");
    expect(minorToDecimalString(-4700025)).toBe("-47000.25");
  });

  it("ida y vuelta no pierde centavos", () => {
    for (const texto of ["0.00", "0.01", "47000.00", "1234567.89", "-12.34"]) {
      expect(minorToDecimalString(decimalArsToMinor(texto))).toBe(texto);
    }
  });
});

describe("formatMinorArs", () => {
  it("separa los miles con punto y los centavos con coma", () => {
    expect(formatMinorArs(4700000)).toBe("$ 47.000,00");
    expect(formatMinorArs(123456789)).toBe("$ 1.234.567,89");
    expect(formatMinorArs(5)).toBe("$ 0,05");
    expect(formatMinorArs(0)).toBe("$ 0,00");
  });
});

import { describe, expect, it } from "vitest";
import { leerEscrito, leerValor, posicionCursor, significativosAntesDe, textoEnvio, textoVisible } from "./entrada";

const visible = (t: string, dec = true) => textoVisible(leerEscrito(t, dec));

describe("lo que escribe la persona", () => {
  it("pone el punto de miles", () => {
    expect(visible("200000")).toBe("200.000");
    expect(visible("1234567")).toBe("1.234.567");
    expect(visible("999")).toBe("999");
  });
  it("reformatea al agregar o borrar dígitos", () => {
    expect(visible("200.0000")).toBe("2.000.000");
    expect(visible("2.00")).toBe("200");
  });
  it("coma decimal, hasta dos dígitos", () => {
    expect(visible("1500,5")).toBe("1.500,5");
    expect(visible("1500,567")).toBe("1.500,56");
    expect(visible("1500,")).toBe("1.500,");
    expect(visible(",5")).toBe("0,5");
  });
  it("sin decimales ignora la coma y lo que sigue", () => {
    expect(visible("1500,50", false)).toBe("1.500");
  });
  it("el punto al final se toma como coma", () => {
    expect(textoVisible(leerEscrito("1.500.", true, true))).toBe("1.500,");
  });
  it("ignora letras, $ y ceros a la izquierda", () => {
    expect(visible("$ 0012a3")).toBe("123");
    expect(visible("")).toBe("");
  });
});

describe("lo que llega desde afuera", () => {
  it("formato de máquina", () => {
    expect(textoVisible(leerValor("200000.50", true))).toBe("200.000,50");
    expect(textoVisible(leerValor(200000.5, true))).toBe("200.000,5");
    expect(textoVisible(leerValor("200000", true))).toBe("200.000");
  });
  it("formato argentino", () => {
    expect(textoVisible(leerValor("47.000", true))).toBe("47.000");
    expect(textoVisible(leerValor("3.000,50", true))).toBe("3.000,50");
  });
  it("vacío", () => {
    expect(textoVisible(leerValor("", true))).toBe("");
    expect(textoVisible(leerValor(null, true))).toBe("");
  });
});

describe("lo que se envía", () => {
  it("sin separador de miles, con el decimal pedido", () => {
    const p = leerEscrito("1.500,5", true);
    expect(textoEnvio(p, "coma")).toBe("1500,5");
    expect(textoEnvio(p, "punto")).toBe("1500.5");
    expect(textoEnvio(leerEscrito("1.500,", true), "punto")).toBe("1500");
    expect(textoEnvio(leerEscrito("", true), "coma")).toBe("");
  });
});

describe("cursor", () => {
  it("queda detrás del mismo dígito tras reformatear", () => {
    // "20000|" + "0" → "200.000|"
    expect(posicionCursor("200.000", significativosAntesDe("200000", 6))).toBe(7);
    // escribir un 5 al principio: "5|200.000" → "5.200.000", cursor tras el 5
    expect(posicionCursor("5.200.000", significativosAntesDe("5200.000", 1))).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { MARCA_SEGUIMIENTO_CONSULTA, pasoPrecio, textoSeguimientoConsulta } from "./seguimiento-consulta";

describe("pasoPrecio", () => {
  it("reconoce un mensaje del bot con precios", () => {
    expect(pasoPrecio("La copia 10x15 sale $ 1.200 cada una.")).toBe(true);
    expect(pasoPrecio("Son $15.000 en total")).toBe(true);
  });
  it("no confunde mensajes sin importes", () => {
    expect(pasoPrecio("¿Qué medida querés?")).toBe(false);
    expect(pasoPrecio(null)).toBe(false);
  });
});

describe("textoSeguimientoConsulta", () => {
  it("corto, con el nombre de pila y una sola pregunta", () => {
    const t = textoSeguimientoConsulta("Ana María López");
    expect(t.startsWith("¡Hola Ana!")).toBe(true);
    expect(t.length).toBeLessThan(200);
    expect(t.match(/\?/g)?.length).toBe(1);
  });
  it("sin nombre saluda igual", () => {
    expect(textoSeguimientoConsulta(null).startsWith("¡Hola!")).toBe(true);
  });
  it("la marca es fija (sirve para no repetirlo)", () => {
    expect(MARCA_SEGUIMIENTO_CONSULTA).toBe("Seguimiento de consulta enviado");
  });
});

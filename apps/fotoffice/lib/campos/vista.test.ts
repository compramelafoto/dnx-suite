import { describe, expect, it } from "vitest";
import { hrefSeguro, valoresCambiados, vistaDeCampo } from "./vista";

const campo = (type: Parameters<typeof vistaDeCampo>[0]["type"], extra: Partial<Parameters<typeof vistaDeCampo>[0]> = {}) => ({
  id: "f", name: "Campo", type, required: false, opciones: [], etiquetas: {}, ...extra,
});

describe("hrefSeguro", () => {
  it("sólo http y https se vuelven enlace", () => {
    expect(hrefSeguro("https://drive.example.com/x?a=1")).toBe("https://drive.example.com/x?a=1");
    expect(hrefSeguro("http://a.com")).toBe("http://a.com");
    expect(hrefSeguro("javascript:alert(1)")).toBeNull();
    expect(hrefSeguro("data:text/html,hola")).toBeNull();
    expect(hrefSeguro("mailto:a@b.com")).toBeNull();
    expect(hrefSeguro("drive.example.com")).toBeNull();
    expect(hrefSeguro("")).toBeNull();
    expect(hrefSeguro(null)).toBeNull();
  });
});

describe("vistaDeCampo", () => {
  it("fecha de calendario dd/mm/aaaa sin correrla de zona", () => {
    expect(vistaDeCampo(campo("FECHA"), { fecha: "2026-01-01" })).toMatchObject({ legible: "01/01/2026", crudo: "2026-01-01" });
  });
  it("Sí/No legible y crudo como lo espera la validación", () => {
    expect(vistaDeCampo(campo("SI_NO"), { booleano: false })).toMatchObject({ legible: "No", crudo: "no" });
    expect(vistaDeCampo(campo("SI_NO"), null)).toMatchObject({ legible: "", crudo: "" });
  });
  it("número con coma", () => {
    expect(vistaDeCampo(campo("NUMERO"), { numero: "1500.5" })).toMatchObject({ legible: "1500,5", crudo: "1500,5" });
  });
  it("un enlace guardado que no es http(s) se muestra como texto, sin href", () => {
    expect(vistaDeCampo(campo("ENLACE"), { texto: "javascript:alert(1)" }).href).toBeNull();
    expect(vistaDeCampo(campo("TEXTO"), { texto: "https://a.com" }).href).toBeNull();
  });
  it("lista: una opción archivada sólo aparece si es el valor actual", () => {
    const c = campo("LISTA", { opciones: [{ id: "o1", label: "A" }], etiquetas: { o1: "A", o2: "B" } });
    expect(vistaDeCampo(c, null).opciones).toEqual([{ id: "o1", label: "A" }]);
    expect(vistaDeCampo(c, { opcionId: "o2" })).toMatchObject({
      legible: "B",
      crudo: "o2",
      opciones: [{ id: "o1", label: "A" }, { id: "o2", label: "B (archivada)" }],
    });
  });
});

describe("valoresCambiados", () => {
  const campos = [
    { id: "a", crudo: "hola" },
    { id: "b", crudo: "" },
    { id: "c", crudo: "1500,5" },
    { id: "d", crudo: "si" },
  ];
  it("sin cambios (o sólo espacios en los bordes): nada", () => {
    expect(valoresCambiados(campos, { a: " hola ", b: "", c: "1500,5", d: "si" })).toEqual({});
    expect(valoresCambiados(campos, {})).toEqual({ a: null, c: null, d: null });
  });
  it("sólo los que cambiaron; vaciar manda null", () => {
    expect(valoresCambiados(campos, { a: "hola", b: " nuevo ", c: "", d: "no" })).toEqual({ b: "nuevo", c: null, d: "no" });
  });
});

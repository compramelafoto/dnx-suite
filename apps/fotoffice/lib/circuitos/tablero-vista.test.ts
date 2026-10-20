import { describe, expect, it } from "vitest";
import { clasePuntoDeEtapa, iniciales, porcentajeDe, resumenDeColumnas } from "./tablero-vista";

describe("clasePuntoDeEtapa", () => {
  it("da el color de la etapa y gris si no lo conoce", () => {
    expect(clasePuntoDeEtapa("verde")).toBe("bg-emerald-500");
    expect(clasePuntoDeEtapa("fucsia")).toBe("bg-slate-400");
    expect(clasePuntoDeEtapa("")).toBe("bg-slate-400");
  });
});

describe("iniciales", () => {
  it("toma la primera y la última palabra", () => {
    expect(iniciales("Daniel Cuart")).toBe("DC");
    expect(iniciales("maría josé de la torre")).toBe("MT");
    expect(iniciales("Belén")).toBe("B");
  });
  it("de un correo, sólo la primera letra", () => {
    expect(iniciales("ana.lopez@gmail.com")).toBe("A");
  });
  it("sin nombre, un signo de pregunta", () => {
    expect(iniciales("   ")).toBe("?");
  });
});

describe("resumenDeColumnas", () => {
  it("suma cantidad y valor de todas las columnas", () => {
    expect(resumenDeColumnas([{ total: 3, valorTotal: 1000 }, { total: 0, valorTotal: 0 }, { total: 2, valorTotal: 500 }])).toEqual({ total: 5, valor: 1500 });
    expect(resumenDeColumnas([])).toEqual({ total: 0, valor: 0 });
  });
});

describe("porcentajeDe", () => {
  it("redondea y no pasa de 100", () => {
    expect(porcentajeDe(1, 3)).toBe(33);
    expect(porcentajeDe(5, 5)).toBe(100);
    expect(porcentajeDe(0, 5)).toBe(0);
    expect(porcentajeDe(3, 0)).toBe(0);
  });
});

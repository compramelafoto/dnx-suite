import { describe, expect, it } from "vitest";
import { emparejarSugeridos, proveedorDesdeTexto } from "./emparejar";
import type { RenglonLista } from "./csv";

function renglon(p: Partial<RenglonLista>): RenglonLista {
  return { fila: 1, proveedor: "La Isla", vigencia: "2026-10", tipo: "PRODUCTO", categoria: "", producto: "", modelo: null, medida: null, variante: null, cantidadMinima: null, unidad: "unidad", costoMinor: 100, codigoProveedor: null, notas: null, clave: "k", ...p };
}

const productos = [
  { id: "amp2040", name: "Ampliación 20x40", categoryName: "Ampliaciones" },
  { id: "canvas4060", name: "Cuadro canvas 40x60", categoryName: "Cuadros canvas" },
  { id: "mdf2030", name: "Cuadro MDF 20x30", categoryName: "Cuadros MDF" },
  { id: "amp2030", name: "Ampliación 20x30 próxima semana", categoryName: "Ampliaciones" },
  { id: "iman913", name: "Fotoimán 9x13", categoryName: "Fotoimanes" },
];

describe("emparejarSugeridos", () => {
  const sugerido = (r: RenglonLista) => emparejarSugeridos([r], productos).get(r.clave) ?? [];
  it("la fotografía del laboratorio es la ampliación de la misma medida", () => {
    expect(sugerido(renglon({ categoria: "Laboratorio proceso químico", producto: "Fotografía digital", medida: "20x40" }))).toEqual(["amp2040"]);
  });
  it("entre varios de la misma medida, el que comparte palabras", () => {
    expect(sugerido(renglon({ categoria: "Cuadros", producto: "Cuadro vinilo en MDF", medida: "20x30" }))).toEqual(["mdf2030"]);
    expect(sugerido(renglon({ categoria: "Fotoimanes", producto: "Fotoimán", medida: "9x13" }))).toEqual(["iman913"]);
  });
  it("sin palabras en común no sugiere, aunque la medida coincida", () => {
    expect(sugerido(renglon({ categoria: "Escolares", producto: "Díptico", medida: "20x40" }))).toEqual([]);
  });
  it("sin medida en común no sugiere nada", () => {
    expect(sugerido(renglon({ producto: "Foto", medida: "13x18" }))).toEqual([]);
  });
  it("sólo sugiere para renglones de tipo PRODUCTO", () => {
    expect(sugerido(renglon({ tipo: "TAPA", producto: "Ampliación", medida: "20x40" }))).toEqual([]);
  });
  it("un renglón alimenta todos los tramos de una copia", () => {
    const tramos = [
      { id: "c10", name: "Copia para mañana 10x15 · más de 10", categoryName: "Copias para mañana" },
      { id: "c50", name: "Copia para mañana 10x15 · más de 50", categoryName: "Copias para mañana" },
    ];
    const r = renglon({ categoria: "Laboratorio", producto: "Fotografía digital", medida: "10x15" });
    expect(emparejarSugeridos([r], tramos).get(r.clave)).toEqual(["c10", "c50"]);
  });
  it("un producto queda con un solo renglón: gana el de más puntaje", () => {
    const a = renglon({ fila: 1, clave: "a", categoria: "Laboratorio", producto: "Foto", medida: "20x30" });
    const b = renglon({ fila: 2, clave: "b", categoria: "Cuadros", producto: "Cuadro vinilo MDF", medida: "20x30" });
    const c = renglon({ fila: 3, clave: "c", categoria: "Cuadros", producto: "Cuadro foto en MDF", medida: "20x30" });
    const r = emparejarSugeridos([a, b, c], productos);
    expect(r.get("b")).toEqual(["mdf2030"]);
    expect(r.get("c")).toBeUndefined();
  });
});

describe("proveedorDesdeTexto", () => {
  const proveedores = [{ id: "r", name: "Román" }, { id: "i", name: "La Isla" }];
  it("une sin tildes ni mayúsculas", () => {
    expect(proveedorDesdeTexto("ROMAN", proveedores)).toBe("r");
    expect(proveedorDesdeTexto("LA ISLA", proveedores)).toBe("i");
    expect(proveedorDesdeTexto("Pascal", proveedores)).toBeNull();
    expect(proveedorDesdeTexto(null, proveedores)).toBeNull();
  });
});

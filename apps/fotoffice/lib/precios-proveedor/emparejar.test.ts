import { describe, expect, it } from "vitest";
import { emparejarSugeridos, proveedorDesdeTexto, sugerirProducto } from "./emparejar";
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

describe("sugerirProducto", () => {
  it("elige el de la misma medida", () => {
    expect(sugerirProducto(renglon({ categoria: "Laboratorio proceso químico", producto: "Fotografía", medida: "20x40" }), productos)).toBe("amp2040");
  });
  it("entre varios de la misma medida, el que comparte palabras", () => {
    expect(sugerirProducto(renglon({ categoria: "Cuadros", producto: "Cuadro vinilo en MDF", medida: "20x30" }), productos)).toBe("mdf2030");
    expect(sugerirProducto(renglon({ categoria: "Fotoimanes", producto: "Fotoimán", medida: "9x13" }), productos)).toBe("iman913");
  });
  it("sin medida en común no sugiere nada", () => {
    expect(sugerirProducto(renglon({ producto: "Foto", medida: "13x18" }), productos)).toBeNull();
  });
  it("sólo sugiere para renglones de tipo PRODUCTO", () => {
    expect(sugerirProducto(renglon({ tipo: "TAPA", producto: "Tapa", medida: "20x40" }), productos)).toBeNull();
  });
});

describe("emparejarSugeridos", () => {
  it("un producto queda con un solo renglón: gana el de más puntaje", () => {
    const a = renglon({ fila: 1, clave: "a", categoria: "Laboratorio", producto: "Foto", medida: "20x30" });
    const b = renglon({ fila: 2, clave: "b", categoria: "Cuadros", producto: "Cuadro vinilo MDF", medida: "20x30" });
    const c = renglon({ fila: 3, clave: "c", categoria: "Cuadros", producto: "Cuadro foto en MDF", medida: "20x30" });
    const r = emparejarSugeridos([a, b, c], productos);
    expect(r.get("b")).toBe("mdf2030");
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

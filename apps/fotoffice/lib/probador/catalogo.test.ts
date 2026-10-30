import { describe, expect, it } from "vitest";
import { armarCatalogo, cotizar, medidaDeNombre, medidaMasCercana, precioDe, tipoDeProducto } from "./catalogo";
import { cambiarCuadro, desdePlantilla } from "./composicion";

const p = (id: string, name: string, priceArs: number, supplierName: string | null = null) => ({ id, name, priceArs, supplierName });

// Nombres tal como están en el catálogo de DNX Estudio (30/10/2026).
const CATALOGO = armarCatalogo([
  p("c1", "Cuadro canvas 30x40", 60000),
  p("c2", "Cuadro canvas 50x70", 105000),
  p("c3", "Cuadro canvas 40x60", 87000),
  p("m1", "Cuadro MDF 50x75", 44400),
  p("a1", "Ampliación 20x30 para mañana", 4500),
  p("a2", "Ampliación 20x30 próxima semana", 3000),
  p("x1", "Cuadro canvas 20x30", 0),
  p("v1", "Cuadro portarretratos de madera y vidrio 15x20 / 30x40 cm", 9000, "TiendaVGO"),
  p("f1", "Fotocopia color", 800),
]);

describe("los precios del probador salen del catálogo", () => {
  it("reconoce el tipo por el nombre", () => {
    expect(tipoDeProducto("Cuadro canvas 30x40")).toBe("CANVAS");
    expect(tipoDeProducto("Cuadro MDF 70x100")).toBe("MDF");
    expect(tipoDeProducto("Ampliación 30x45")).toBe("IMPRESION");
    expect(tipoDeProducto("Copia para mañana 10x15 · más de 10")).toBeNull();
  });

  it("lee la medida del nombre, con el lado corto primero", () => {
    expect(medidaDeNombre("Cuadro canvas 70 X 50")).toEqual({ corto: 50, largo: 70 });
    expect(medidaDeNombre("Fotocopia color")).toBeNull();
  });

  it("deja afuera precio 0, los marcos de VGO y lo que no es cuadro", () => {
    expect(CATALOGO.map((x) => x.productoId).sort()).toEqual(["a1", "c1", "c2", "c3", "m1"]);
  });

  it("con dos productos de la misma medida se queda con el más caro", () => {
    expect(precioDe(CATALOGO, "IMPRESION", 30, 20)?.precioArs).toBe(4500);
  });

  it("el precio vale en las dos orientaciones", () => {
    expect(precioDe(CATALOGO, "CANVAS", 70, 50)?.precioArs).toBe(105000);
    expect(precioDe(CATALOGO, "CANVAS", 45, 45)).toBeNull();
  });

  it("acerca una medida libre a la medida con precio más parecida, sin cambiar la orientación", () => {
    expect(medidaMasCercana(CATALOGO, "CANVAS", 30, 42)).toEqual({ w: 30, h: 40 });
    expect(medidaMasCercana(CATALOGO, "CANVAS", 68, 48)).toEqual({ w: 70, h: 50 });
    expect(medidaMasCercana(CATALOGO, "MARCO", 30, 40)).toBeNull();
  });

  it("cotiza la composición con un renglón por medida y cuenta lo que no tiene precio", () => {
    let c = desdePlantilla("triptico", 30, 40, 5, "CANVAS", { x: 0, y: 0 });
    c = cambiarCuadro(c, c.cuadros[2].id, { tipo: "MARCO" });
    const r = cotizar(CATALOGO, c);
    expect(r.total).toBe(120000);
    expect(r.sinPrecio).toBe(1);
    expect(r.lineas).toContainEqual({ tipo: "CANVAS", corto: 30, largo: 40, cantidad: 2, precioArs: 60000 });
    expect(r.lineas).toContainEqual({ tipo: "MARCO", corto: 30, largo: 40, cantidad: 1, precioArs: null });
  });
});

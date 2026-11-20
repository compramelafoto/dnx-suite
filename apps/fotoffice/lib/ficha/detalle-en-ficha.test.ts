import { describe, expect, it } from "vitest";
import { esVistaFicha, hrefCompleto, hrefVerEnFicha, leerDetallePedido } from "./detalle-en-ficha";

describe("detalle en la ficha", () => {
  it("arma el enlace y lo vuelve a leer", () => {
    const href = hrefVerEnFicha("cl1", "consulta", "abc_1");
    expect(href).toBe("/clientes/cl1?ver=consulta:abc_1#detalle");
    expect(leerDetallePedido("consulta:abc_1")).toEqual({ tipo: "consulta", id: "abc_1" });
  });
  it("rechaza tipos desconocidos o ids con basura", () => {
    expect(leerDetallePedido("factura:x")).toBeNull();
    expect(leerDetallePedido("pedido:../x")).toBeNull();
    expect(leerDetallePedido(":x")).toBeNull();
    expect(leerDetallePedido(undefined)).toBeNull();
    expect(leerDetallePedido(["pedido:p1", "x"])).toEqual({ tipo: "pedido", id: "p1" });
  });
  it("la pantalla completa de cada tipo", () => {
    expect(hrefCompleto("cotizacion", "q1")).toBe("/presupuestos/q1");
    expect(hrefCompleto("proyecto", "p1")).toBe("/proyectos/p1");
  });
  it("reconoce la vista incrustada", () => {
    expect(esVistaFicha({ vista: "ficha" })).toBe(true);
    expect(esVistaFicha({})).toBe(false);
    expect(esVistaFicha(undefined)).toBe(false);
  });
});

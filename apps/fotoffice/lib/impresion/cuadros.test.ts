import { describe, expect, it } from "vitest";
import { cuadroDeMedida, doblezEnPx, etiquetaDeCuadro, leerProductosDeCuadro } from "./cuadros";

const prod = (id: string, name: string, priceArs = 60000) => ({ id, name, priceArs, costArs: 22000, preferredProveedorId: "isla" });

describe("cuadros", () => {
  it("lee canvas y MDF del catálogo con el tipo en la medida", () => {
    const r = leerProductosDeCuadro([prod("a", "Cuadro canvas 30x40"), prod("b", "Cuadro MDF 50x75"), prod("c", "Copia para mañana 10x15"), prod("d", "Cuadro canvas 20x30", 0)]);
    expect(r.map((p) => [p.id, p.medida, p.plazo, p.desde])).toEqual([
      ["a", "Canvas 30x40", "SEMANA", 0],
      ["b", "MDF 50x75", "SEMANA", 0],
    ]);
  });
  it("reconoce la medida de un cuadro y no la de una copia", () => {
    expect(cuadroDeMedida("Canvas 30x40")).toEqual({ tipo: "CANVAS", base: "30x40" });
    expect(cuadroDeMedida("MDF 70x100")).toEqual({ tipo: "MDF", base: "70x100" });
    expect(cuadroDeMedida("30x40")).toBeNull();
  });
  it("5 cm a 300 ppp en un frente de 30 cm de ancho", () => {
    expect(doblezEnPx(3543, 300)).toBe(591);
  });
  it("la etiqueta para el laboratorio dice el doblez y su relleno", () => {
    expect(etiquetaDeCuadro("Canvas 30x40", undefined)).toBe("Canvas 30x40 + doblez 5 cm (espejo)");
    expect(etiquetaDeCuadro("MDF 30x40", "COLOR")).toBe("MDF 30x40 + doblez 5 cm (color liso)");
    expect(etiquetaDeCuadro("10x15", "ESPEJO")).toBeNull();
  });
});

import { medidaEnMm, opcionesDelCatalogo, renglonesDelPedido } from "./laboratorio";
import { leerProductosDeCopia } from "@/lib/impresiones/catalogo-copias";

describe("cuadros en el pedido para laboratorio", () => {
  const productos = [prod("c10", "Copia para mañana 10x15", 800), prod("cnv", "Cuadro canvas 30x40", 60000), prod("mdf", "Cuadro MDF 30x40", 28800)];
  const catalogo = [...leerProductosDeCopia(productos), ...leerProductosDeCuadro(productos)];
  it("el frente del cuadro mide lo nominal", () => {
    expect(medidaEnMm("Canvas 30x40")).toEqual({ anchoMm: 300, altoMm: 400 });
  });
  it("aparecen después de las copias, sólo para la próxima semana", () => {
    expect(opcionesDelCatalogo(catalogo, null).medidas).toEqual([
      { medida: "10x15", plazos: ["MANANA"] },
      { medida: "Canvas 30x40", plazos: ["SEMANA"] },
      { medida: "MDF 30x40", plazos: ["SEMANA"] },
    ]);
  });
  it("se cobran por unidad y van al laboratorio del producto", () => {
    const r = renglonesDelPedido([{ originalId: "o1", medida: "Canvas 30x40", plazo: "SEMANA", papel: "MATE", cantidad: 2 }], catalogo, new Map());
    expect(r.ok && r.renglones).toEqual([{ productId: "cnv", cantidad: 2, precioUnitario: 60000, proveedorId: "isla", claves: ["Canvas 30x40|SEMANA"], costoUnitario: 22000 }]);
  });
});

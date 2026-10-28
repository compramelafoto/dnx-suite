import { describe, expect, it } from "vitest";
import { agruparPorLaboratorio, etiquetaTamano, resumenParaLab, rutasDelZip } from "./carpeta-lab";

const items = [
  { itemId: "1", proveedorId: "f", widthCm: 13, heightCm: 18, quantity: 1, sourceName: "rollo-01.tif" },
  { itemId: "2", proveedorId: "f", widthCm: 13, heightCm: 18, quantity: 2, sourceName: "rollo-03.jpg" },
  { itemId: "3", proveedorId: "f", widthCm: 13, heightCm: 18, quantity: 1, sourceName: "rollo-07.jpg" },
  { itemId: "4", proveedorId: "i", widthCm: 30, heightCm: 40, quantity: 1, sourceName: "rollo-01.tif" },
];

describe("agruparPorLaboratorio", () => {
  it("separa por proveedor", () => {
    const g = agruparPorLaboratorio(items);
    expect(g.get("f")?.map((i) => i.itemId)).toEqual(["1", "2", "3"]);
    expect(g.get("i")?.map((i) => i.itemId)).toEqual(["4"]);
  });
});

describe("rutasDelZip", () => {
  it("ordena por tamaño, papel y cantidad, y pasa todo a .jpg", () => {
    expect(rutasDelZip(123, "Juan Pérez", "BRILLO", items.slice(0, 3))).toEqual([
      { itemId: "1", ruta: "Pedido 123 - Juan Pérez/13x18 Brillo/1 copia/rollo-01.jpg" },
      { itemId: "2", ruta: "Pedido 123 - Juan Pérez/13x18 Brillo/2 copias/rollo-03.jpg" },
      { itemId: "3", ruta: "Pedido 123 - Juan Pérez/13x18 Brillo/1 copia/rollo-07.jpg" },
    ]);
  });
  it("no repite nombres dentro de la misma carpeta", () => {
    const r = rutasDelZip(1, "Ana", "MATE", [
      { itemId: "a", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 1, sourceName: "x.jpg" },
      { itemId: "b", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 1, sourceName: "x.png" },
    ]);
    expect(new Set(r.map((x) => x.ruta)).size).toBe(2);
  });
  it("limpia barras del nombre del cliente", () => {
    expect(rutasDelZip(1, "A/B", "MATE", items.slice(0, 1))[0].ruta.startsWith("Pedido 1 - A-B/")).toBe(true);
  });
  it("muestra medidas con decimales sin ceros de más", () => {
    expect(etiquetaTamano(15, 21)).toBe("15x21");
    expect(etiquetaTamano(10.5, 15)).toBe("10.5x15");
  });
});

describe("resumenParaLab", () => {
  it("suma copias por tamaño", () => {
    expect(resumenParaLab(items.slice(0, 3), "BRILLO")).toEqual([{ tamano: "13x18", papel: "Brillo", cantidad: 4 }]);
  });
});

describe("papel por foto y archivos originales", () => {
  it("cada foto va a la carpeta de su papel y conserva su extensión si es original", () => {
    const r = rutasDelZip(5, "Ana", "BRILLO", [
      { itemId: "a", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 1, sourceName: "uno.png", paper: "MATE", original: true },
      { itemId: "b", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 1, sourceName: "dos.jpg" },
    ]);
    expect(r.map((x) => x.ruta)).toEqual(["Pedido 5 - Ana/10x15 Mate/1 copia/uno.png", "Pedido 5 - Ana/10x15 Brillo/1 copia/dos.jpg"]);
  });

  it("el resumen separa por papel", () => {
    const r = resumenParaLab([
      { itemId: "a", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 2, sourceName: "x", paper: "MATE" },
      { itemId: "b", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 3, sourceName: "y" },
    ], "BRILLO");
    expect(r).toEqual([{ tamano: "10x15", papel: "Mate", cantidad: 2 }, { tamano: "10x15", papel: "Brillo", cantidad: 3 }]);
  });
});

import { describe, expect, it } from "vitest";
import { globalFieldsFromProduct, prefillFromGlobal } from "./global-catalog-fields";

describe("globalFieldsFromProduct — lo que se comparte y lo que no", () => {
  const producto = {
    name: "Portarretratos VGO 13x18",
    brand: "VGO",
    description: "Madera, marrón",
    imageUrl: "https://r2/foto.jpg",
    // Todo lo de abajo es del negocio y NO puede salir:
    priceMinor: 1_250_000,
    costMinor: 800_000,
    stockQty: 7,
    minStockQty: 2,
    supplierName: "Distribuidora Rosario",
    sku: "TRP-12",
    workspaceId: "ws-privado",
  };

  it("comparte nombre, marca, descripción y foto", () => {
    expect(globalFieldsFromProduct(producto)).toEqual({
      name: "Portarretratos VGO 13x18",
      brand: "VGO",
      description: "Madera, marrón",
      imageUrl: "https://r2/foto.jpg",
    });
  });

  it("NO comparte el precio, el costo ni la existencia", () => {
    const campos = globalFieldsFromProduct(producto) as Record<string, unknown>;
    for (const prohibido of ["priceMinor", "costMinor", "stockQty", "minStockQty"]) {
      expect(campos[prohibido]).toBeUndefined();
    }
  });

  it("NO comparte el proveedor, el código interno ni el workspace", () => {
    const campos = globalFieldsFromProduct(producto) as Record<string, unknown>;
    for (const prohibido of ["supplierName", "sku", "workspaceId"]) {
      expect(campos[prohibido]).toBeUndefined();
    }
  });

  it("la lista de campos compartidos es EXACTAMENTE esa y ninguno más", () => {
    // Esta prueba es la red: si mañana alguien agrega un campo a la ficha global sin
    // pensarlo, esto se rompe y lo obliga a decidir a propósito si ese campo es identidad
    // o es comercio.
    expect(Object.keys(globalFieldsFromProduct(producto)).sort()).toEqual(
      ["brand", "description", "imageUrl", "name"],
    );
  });

  it("los campos vacíos viajan como null, no como cadena vacía", () => {
    const r = globalFieldsFromProduct({ name: "Cosa", brand: null, description: null, imageUrl: null });
    expect(r.brand).toBeNull();
    expect(r.description).toBeNull();
    expect(r.imageUrl).toBeNull();
  });
});

describe("prefillFromGlobal — sugiere, no manda", () => {
  it("sin ficha global, el formulario arranca vacío", () => {
    expect(prefillFromGlobal(null)).toEqual({
      name: "", brand: null, description: null, imageUrl: null, foundInGlobal: false,
    });
  });

  it("con ficha global, precarga los cuatro campos y avisa que la encontró", () => {
    const r = prefillFromGlobal({
      name: "Portarretratos VGO", brand: "VGO", description: "Madera", imageUrl: "https://r2/f.jpg",
    });
    expect(r).toEqual({
      name: "Portarretratos VGO", brand: "VGO", description: "Madera",
      imageUrl: "https://r2/f.jpg", foundInGlobal: true,
    });
  });

  it("nunca precarga un precio, porque la ficha global no tiene ninguno", () => {
    const r = prefillFromGlobal({ name: "X", brand: null, description: null, imageUrl: null }) as Record<string, unknown>;
    expect(r.priceMinor).toBeUndefined();
    expect(r.price).toBeUndefined();
  });
});

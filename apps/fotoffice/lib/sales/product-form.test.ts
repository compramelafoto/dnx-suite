import { describe, expect, it } from "vitest";
import { parseProductForm } from "./product-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const base = { name: "Portarretratos VGO 13x18", priceArs: "12.500" };

describe("parseProductForm", () => {
  it("un producto con nombre y precio alcanza", () => {
    const r = parseProductForm(form(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Portarretratos VGO 13x18");
    expect(r.values.priceMinor).toBe(1_250_000);
  });

  it("por omisión es un producto que controla stock", () => {
    const r = parseProductForm(form(base));
    expect(r.ok && r.values.kind).toBe("PRODUCTO");
    expect(r.ok && r.values.tracksStock).toBe(true);
  });

  it("un servicio nunca controla stock, aunque venga marcado", () => {
    const r = parseProductForm(form({ ...base, kind: "SERVICIO", tracksStock: "on" }));
    expect(r.ok && r.values.kind).toBe("SERVICIO");
    expect(r.ok && r.values.tracksStock).toBe(false);
  });

  it("un producto SÍ puede no controlar stock: el cuadro tercerizado", () => {
    const r = parseProductForm(form({ ...base, kind: "PRODUCTO", tracksStock: "off" }));
    expect(r.ok && r.values.kind).toBe("PRODUCTO");
    expect(r.ok && r.values.tracksStock).toBe(false);
  });

  it("sin nombre se rechaza", () => {
    expect(parseProductForm(form({ ...base, name: "  " }))).toEqual({
      ok: false,
      error: "Poné un nombre para el producto.",
    });
  });

  it("un precio que no se entiende se rechaza", () => {
    expect(parseProductForm(form({ ...base, priceArs: "gratis" }))).toEqual({
      ok: false,
      error: "El precio no se entiende.",
    });
  });

  it("el precio puede ser cero: hay cosas que se entregan sin cargo", () => {
    const r = parseProductForm(form({ ...base, priceArs: "0" }));
    expect(r.ok && r.values.priceMinor).toBe(0);
  });

  it("acepta el precio escrito como lo escribe la gente", () => {
    expect(parseProductForm(form({ ...base, priceArs: "12.500,50" })).ok).toBe(true);
    expect(parseProductForm(form({ ...base, priceArs: "$ 12500" })).ok).toBe(true);
  });

  it("el costo es opcional y vacío queda null, no cero", () => {
    const r = parseProductForm(form({ ...base, costArs: "  " }));
    expect(r.ok && r.values.costMinor).toBeNull();
  });

  it("un costo que no se entiende se rechaza en vez de guardarse como cero", () => {
    expect(parseProductForm(form({ ...base, costArs: "ni idea" }))).toEqual({
      ok: false,
      error: "El costo no se entiende.",
    });
  });

  it("el código de barras se normaliza", () => {
    const r = parseProductForm(form({ ...base, barcode: " 779-1234 567890 " }));
    expect(r.ok && r.values.barcode).toBe("7791234567890");
  });

  it("un código de barras con letras se rechaza", () => {
    expect(parseProductForm(form({ ...base, barcode: "ABC123" }))).toEqual({
      ok: false,
      error: "Ese código de barras no se entiende: son sólo números.",
    });
  });

  it("el código interno se recorta pero se respeta: se lo inventa el negocio", () => {
    const r = parseProductForm(form({ ...base, sku: "  TRP-12  " }));
    expect(r.ok && r.values.sku).toBe("TRP-12");
  });

  it("la marca es texto libre: se recorta pero se respeta", () => {
    const r = parseProductForm(form({ ...base, brand: "  VGO  " }));
    expect(r.ok && r.values.brand).toBe("VGO");
  });

  it("la marca vacía queda null, como el resto de los campos de texto", () => {
    const r = parseProductForm(form(base));
    expect(r.ok && r.values.brand).toBeNull();
  });

  it("un tipo inventado se rechaza", () => {
    expect(parseProductForm(form({ ...base, kind: "COSA" }))).toEqual({
      ok: false,
      error: "Eso tiene que ser un producto o un servicio.",
    });
  });

  it("el mínimo de stock vacío queda null: vacío y basura no son lo mismo", () => {
    const r = parseProductForm(form(base));
    expect(r.ok && r.values.minStockQty).toBeNull();
  });

  it("un mínimo de stock que no se entiende se rechaza en vez de guardarse como null", () => {
    expect(parseProductForm(form({ ...base, minStockQty: "tres" }))).toEqual({
      ok: false,
      error: "El mínimo de stock no se entiende.",
    });
  });

  it("un mínimo de stock negativo se rechaza", () => {
    expect(parseProductForm(form({ ...base, minStockQty: "-3" }))).toEqual({
      ok: false,
      error: "El mínimo de stock no puede ser negativo.",
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildTicketLines, resolveCheckoutClientInput, type RawCheckoutLine } from "./checkout";

const renglonProducto = (over: Partial<RawCheckoutLine> = {}): RawCheckoutLine => ({
  productId: "p1",
  description: "lo que sea que mandó el navegador",
  qty: 2,
  unitPriceMinor: 1_500_00,
  ...over,
});

const productos = new Map([["p1", { id: "p1", name: "Trípode", priceMinor: 1_500_00, costMinor: 800_00 }]]);

describe("buildTicketLines", () => {
  it("un renglón con producto toma nombre y costo de la base, no del navegador", () => {
    const r = buildTicketLines([renglonProducto()], productos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines).toEqual([
      {
        productId: "p1",
        description: "Trípode",
        qty: 2,
        unitPriceMinor: 1_500_00,
        unitCostMinor: 800_00,
        priceWasOverridden: false,
        variantId: null,
      },
    ]);
  });

  it("un precio distinto del catálogo se marca pisado — no importa lo que mande el navegador", () => {
    const r = buildTicketLines([renglonProducto({ unitPriceMinor: 1_200_00 })], productos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0].unitPriceMinor).toBe(1_200_00);
    expect(r.lines[0].priceWasOverridden).toBe(true);
  });

  it("un precio igual al de catálogo no se marca pisado, aunque el mostrador lo haya retipeado", () => {
    const r = buildTicketLines([renglonProducto({ unitPriceMinor: 1_500_00 })], productos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0].priceWasOverridden).toBe(false);
  });

  it("un producto que no está en el mapa (de otro workspace o borrado) rechaza el ticket entero", () => {
    const r = buildTicketLines([renglonProducto({ productId: "ajeno" })], productos);
    expect(r.ok).toBe(false);
  });

  it("un renglón suelto no cruza nada: usa la descripción tal cual, no tiene costo y nunca se marca pisado", () => {
    const r = buildTicketLines(
      [{ productId: null, description: "  Arreglo a medida  ", qty: 1, unitPriceMinor: 500_00 }],
      productos,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toEqual({
      productId: null,
      description: "Arreglo a medida",
      qty: 1,
      unitPriceMinor: 500_00,
      unitCostMinor: null,
      priceWasOverridden: false,
      variantId: null,
    });
  });

  it("una cantidad no entera rechaza el ticket", () => {
    const r = buildTicketLines([renglonProducto({ qty: 1.5 })], productos);
    expect(r.ok).toBe(false);
  });

  it("un precio no entero rechaza el ticket", () => {
    const r = buildTicketLines([renglonProducto({ unitPriceMinor: 99.9 })], productos);
    expect(r.ok).toBe(false);
  });

  it("un ticket vacío da una lista vacía, no un error", () => {
    const r = buildTicketLines([], productos);
    expect(r).toEqual({ ok: true, lines: [] });
  });
});

describe("buildTicketLines — talles (variantes)", () => {
  const remera = {
    id: "r1",
    name: "Remera",
    priceMinor: 10_000_00,
    costMinor: 4_000_00,
    variants: new Map([
      ["vS", { id: "vS", name: "S", variantPriceMinor: null }],
      ["vXL", { id: "vXL", name: "XL", variantPriceMinor: 12_000_00 }],
    ]),
  };
  const conRemera = new Map([...productos, ["r1", remera]]);
  const renglonRemera = (over: Partial<RawCheckoutLine> = {}): RawCheckoutLine => ({
    productId: "r1",
    variantId: "vXL",
    description: "lo que mandó el navegador",
    qty: 1,
    unitPriceMinor: 12_000_00,
    ...over,
  });

  it("propaga el variantId y arma la descripción con el talle", () => {
    const r = buildTicketLines([renglonRemera()], conRemera);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toEqual({
      productId: "r1",
      variantId: "vXL",
      description: "Remera — XL",
      qty: 1,
      unitPriceMinor: 12_000_00,
      unitCostMinor: 4_000_00,
      priceWasOverridden: false,
    });
  });

  it("el precio de referencia es el de la variante cuando tiene uno propio", () => {
    const r = buildTicketLines([renglonRemera({ unitPriceMinor: 10_000_00 })], conRemera);
    expect(r.ok && r.lines[0].priceWasOverridden).toBe(true);
  });

  it("una variante sin precio propio hereda el del producto", () => {
    const r = buildTicketLines([renglonRemera({ variantId: "vS", unitPriceMinor: 10_000_00 })], conRemera);
    expect(r.ok && r.lines[0].priceWasOverridden).toBe(false);
    expect(r.ok && r.lines[0].description).toBe("Remera — S");
  });

  it("un talle que no es de ese producto (o ya no está activo) rechaza el ticket entero", () => {
    const r = buildTicketLines([renglonRemera({ variantId: "otro" })], conRemera);
    expect(r).toEqual({
      ok: false,
      error: "Alguno de los talles del ticket ya no está disponible. Actualizá la pantalla e intentá de nuevo.",
    });
  });

  it("un producto con talles exige elegir uno", () => {
    const r = buildTicketLines([renglonRemera({ variantId: null })], conRemera);
    expect(r).toEqual({ ok: false, error: "Elegí el talle de Remera." });
  });

  it("un talle en un producto sin talles rechaza el ticket", () => {
    const r = buildTicketLines([renglonProducto({ variantId: "vXL" })], conRemera);
    expect(r.ok).toBe(false);
  });

  it("un renglón suelto ignora cualquier variantId que mande el navegador", () => {
    const r = buildTicketLines(
      [{ productId: null, variantId: "vXL", description: "Suelto", qty: 1, unitPriceMinor: 100 }],
      conRemera,
    );
    expect(r.ok && r.lines[0].variantId).toBe(null);
  });
});

describe("resolveCheckoutClientInput", () => {
  it("sin cliente queda sin cliente", () => {
    expect(resolveCheckoutClientInput({ mode: "none" })).toEqual({ mode: "none" });
  });

  it("un cliente existente conserva el id, recortado", () => {
    expect(resolveCheckoutClientInput({ mode: "existing", clientId: " c1 " })).toEqual({
      mode: "existing",
      clientId: "c1",
    });
  });

  it("un id existente vacío se trata como sin cliente", () => {
    expect(resolveCheckoutClientInput({ mode: "existing", clientId: "   " })).toEqual({ mode: "none" });
  });

  it("un cliente nuevo con nombre limpia los campos vacíos a null", () => {
    expect(
      resolveCheckoutClientInput({ mode: "new", firstName: " Ana ", lastName: "  ", phone: " 3411234567 ", email: "" }),
    ).toEqual({ mode: "new", firstName: "Ana", lastName: null, phone: "3411234567", email: null });
  });

  it("un cliente nuevo sin nombre se trata como sin cliente: no se da de alta una ficha vacía", () => {
    expect(resolveCheckoutClientInput({ mode: "new", firstName: "   ", lastName: "Pérez", phone: "", email: "" })).toEqual({
      mode: "none",
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseCheckoutInput } from "./checkout-input";

const ok = () => ({
  buyerName: "Ana Pérez",
  buyerEmail: "Ana@Example.com",
  buyerPhone: "341 555-1234",
  acceptsTerms: true,
  clientIdempotencyKey: "k".repeat(20),
  lines: [{ productId: "p1", variantId: null, qty: 2 }],
});

function errs(raw: unknown) {
  const r = parseCheckoutInput(raw);
  if (r.ok) throw new Error("debía fallar");
  return r.errors;
}

describe("parseCheckoutInput", () => {
  it("acepta y normaliza", () => {
    const r = parseCheckoutInput(ok());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.buyerEmail).toBe("ana@example.com");
      expect(r.value.buyerPhone).toBe("341 555-1234");
      expect(r.value.acceptsTerms).toBe(true);
    }
  });
  it("teléfono opcional", () => {
    for (const p of [undefined, null, "", "  "]) {
      const r = parseCheckoutInput({ ...ok(), buyerPhone: p });
      expect(r.ok && r.value.buyerPhone).toBe(null);
    }
  });
  it("teléfono con 6–20 dígitos", () => {
    expect(errs({ ...ok(), buyerPhone: "12345" }).buyerPhone).toBeTruthy();
    expect(errs({ ...ok(), buyerPhone: "1".repeat(21) }).buyerPhone).toBeTruthy();
    expect(parseCheckoutInput({ ...ok(), buyerPhone: "123456" }).ok).toBe(true);
  });
  it("nombre mínimo 2", () => {
    expect(errs({ ...ok(), buyerName: " a " }).buyerName).toBeTruthy();
    expect(errs({ ...ok(), buyerName: 3 }).buyerName).toBeTruthy();
  });
  it("email inválido", () => {
    expect(errs({ ...ok(), buyerEmail: "nope" }).buyerEmail).toBeTruthy();
    expect(errs({ ...ok(), buyerEmail: "a@b" }).buyerEmail).toBeTruthy();
  });
  it("términos obligatorios", () => {
    expect(errs({ ...ok(), acceptsTerms: false }).acceptsTerms).toBeTruthy();
    expect(errs({ ...ok(), acceptsTerms: "true" }).acceptsTerms).toBeTruthy();
  });
  it("líneas 1–30, qty 1–99", () => {
    expect(errs({ ...ok(), lines: [] }).lines).toBeTruthy();
    const many = Array.from({ length: 31 }, (_, i) => ({ productId: `p${i}`, variantId: null, qty: 1 }));
    expect(errs({ ...ok(), lines: many }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ productId: "p", variantId: null, qty: 0 }] }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ productId: "p", variantId: null, qty: 100 }] }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ productId: "p", variantId: null, qty: 1.5 }] }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ productId: "", variantId: null, qty: 1 }] }).lines).toBeTruthy();
  });
  it("líneas de obra: listing, formato y 1–20 copias; sin kind sigue siendo producto", () => {
    const obra = { kind: "artwork", artworkListingId: "al1", printFormatId: "f1", qty: 2 };
    const r = parseCheckoutInput({ ...ok(), lines: [{ productId: "p1", variantId: null, qty: 1 }, { ...obra, unitPriceMinor: 1, name: "x" }] });
    expect(r.ok && r.value.lines).toEqual([
      { productId: "p1", variantId: null, qty: 1 },
      { kind: "artwork", artworkListingId: "al1", printFormatId: "f1", qty: 2 },
    ]);
    expect(parseCheckoutInput({ ...ok(), lines: [{ kind: "product", productId: "p1", variantId: null, qty: 1 }] }).ok).toBe(true);
    expect(errs({ ...ok(), lines: [{ ...obra, qty: 21 }] }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ ...obra, qty: 0 }] }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ ...obra, printFormatId: "" }] }).lines).toBeTruthy();
    expect(errs({ ...ok(), lines: [{ ...obra, artworkListingId: undefined }] }).lines).toBeTruthy();
    // Una obra sin `kind` no es nada: ni producto ni obra.
    expect(errs({ ...ok(), lines: [{ artworkListingId: "al1", printFormatId: "f1", qty: 1 }] }).lines).toBeTruthy();
    const muchas = Array.from({ length: 31 }, (_, i) => ({ ...obra, artworkListingId: `al${i}` }));
    expect(errs({ ...ok(), lines: muchas }).lines).toBeTruthy();
  });
  it("clave de idempotencia 16–64", () => {
    expect(errs({ ...ok(), clientIdempotencyKey: "corta" }).clientIdempotencyKey).toBeTruthy();
    expect(errs({ ...ok(), clientIdempotencyKey: "k".repeat(65) }).clientIdempotencyKey).toBeTruthy();
  });
  it("entrada no objeto", () => {
    expect(parseCheckoutInput(null).ok).toBe(false);
    expect(parseCheckoutInput("x").ok).toBe(false);
  });
  it("junta varios errores", () => {
    const e = errs({});
    expect(Object.keys(e).sort()).toEqual(["acceptsTerms", "buyerEmail", "buyerName", "clientIdempotencyKey", "lines"]);
  });
});

describe("parseCheckoutInput: entrega", () => {
  const domicilio = () => ({
    method: "HOME",
    address: {
      street: " Av. Pellegrini ",
      number: "1234",
      floorApt: "",
      city: "Rosario",
      provinceCode: "s",
      postalCode: "S2000ABC",
      recipientPhone: "",
    },
  });
  const sucursal = () => ({
    method: "BRANCH",
    provinceCode: "S",
    agency: { id: "AG01", name: "Rosario Centro", address: "Córdoba 721" },
  });

  it("sin entrega es retiro en la sede (carritos de la etapa 1)", () => {
    for (const delivery of [undefined, null]) {
      const r = parseCheckoutInput({ ...ok(), delivery });
      expect(r.ok && r.value.delivery).toEqual({ method: "PICKUP" });
    }
    const r = parseCheckoutInput({ ...ok(), delivery: { method: "PICKUP" } });
    expect(r.ok && r.value.delivery).toEqual({ method: "PICKUP" });
  });

  it("domicilio: normaliza y el teléfono de quien recibe cae en el de quien compra", () => {
    const r = parseCheckoutInput({ ...ok(), delivery: domicilio() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.delivery).toEqual({
      method: "HOME",
      address: {
        street: "Av. Pellegrini",
        number: "1234",
        floorApt: null,
        city: "Rosario",
        provinceCode: "S",
        postalCode: "2000",
        recipientPhone: "341 555-1234",
      },
    });
  });

  it("domicilio: teléfono propio de quien recibe y piso/depto", () => {
    const d = domicilio();
    const r = parseCheckoutInput({
      ...ok(),
      buyerPhone: "",
      delivery: { ...d, address: { ...d.address, floorApt: " 3° B ", recipientPhone: "341 444 5555" } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok || r.value.delivery.method !== "HOME") throw new Error("debía ser domicilio");
    expect(r.value.delivery.address.floorApt).toBe("3° B");
    expect(r.value.delivery.address.recipientPhone).toBe("341 444 5555");
  });

  it("domicilio sin teléfono de nadie queda en null", () => {
    const r = parseCheckoutInput({ ...ok(), buyerPhone: null, delivery: domicilio() });
    if (!r.ok || r.value.delivery.method !== "HOME") throw new Error("debía ser domicilio");
    expect(r.value.delivery.address.recipientPhone).toBe(null);
  });

  it("domicilio: marca cada campo inválido por separado", () => {
    const d = domicilio();
    const e = errs({
      ...ok(),
      delivery: {
        ...d,
        address: { street: "", number: "1".repeat(21), floorApt: "x".repeat(41), city: "", provinceCode: "I", postalCode: "0123", recipientPhone: "12" },
      },
    });
    expect(Object.keys(e).sort()).toEqual([
      "delivery.city",
      "delivery.floorApt",
      "delivery.number",
      "delivery.postalCode",
      "delivery.provinceCode",
      "delivery.recipientPhone",
      "delivery.street",
    ]);
  });

  it("domicilio: límites de largo", () => {
    const d = domicilio();
    expect(errs({ ...ok(), delivery: { ...d, address: { ...d.address, street: "x".repeat(121) } } })["delivery.street"]).toBeTruthy();
    expect(errs({ ...ok(), delivery: { ...d, address: { ...d.address, city: "x".repeat(81) } } })["delivery.city"]).toBeTruthy();
    expect(parseCheckoutInput({ ...ok(), delivery: { ...d, address: { ...d.address, street: "x".repeat(120) } } }).ok).toBe(true);
  });

  it("domicilio sin dirección", () => {
    expect(errs({ ...ok(), delivery: { method: "HOME" } })["delivery.address"]).toBeTruthy();
  });

  it("sucursal: acepta la forma y normaliza la provincia", () => {
    const r = parseCheckoutInput({ ...ok(), delivery: { ...sucursal(), provinceCode: " s " } });
    expect(r.ok && r.value.delivery).toEqual({
      method: "BRANCH",
      provinceCode: "S",
      agency: { id: "AG01", name: "Rosario Centro", address: "Córdoba 721" },
    });
  });

  it("sucursal: exige una sucursal con forma válida", () => {
    expect(errs({ ...ok(), delivery: { method: "BRANCH", provinceCode: "S" } })["delivery.agency"]).toBeTruthy();
    const s = sucursal();
    expect(errs({ ...ok(), delivery: { ...s, agency: { ...s.agency, id: "" } } })["delivery.agency"]).toBeTruthy();
    expect(errs({ ...ok(), delivery: { ...s, agency: { ...s.agency, name: "x".repeat(201) } } })["delivery.agency"]).toBeTruthy();
    expect(errs({ ...ok(), delivery: { ...s, provinceCode: "Ñ" } })["delivery.provinceCode"]).toBeTruthy();
  });

  it("método desconocido", () => {
    expect(errs({ ...ok(), delivery: { method: "DRONE" } })["delivery.method"]).toBeTruthy();
    expect(errs({ ...ok(), delivery: "HOME" })["delivery.method"]).toBeTruthy();
  });
});

describe("parseCheckoutInput: envío que vio el comprador", () => {
  it("opcional: sin él queda en null", () => {
    const r = parseCheckoutInput(ok());
    expect(r.ok && r.value.shownShippingMinor).toBeNull();
  });
  it("entero no negativo, en centavos", () => {
    const r = parseCheckoutInput({ ...ok(), shownShippingMinor: 4_500_00 });
    expect(r.ok && r.value.shownShippingMinor).toBe(4_500_00);
    const cero = parseCheckoutInput({ ...ok(), shownShippingMinor: 0 });
    expect(cero.ok && cero.value.shownShippingMinor).toBe(0);
  });
  it("basura (negativo, decimal, texto): se ignora como si no lo hubiera mandado", () => {
    for (const v of [-1, 1.5, "4500", Number.NaN]) {
      const r = parseCheckoutInput({ ...ok(), shownShippingMinor: v });
      expect(r.ok && r.value.shownShippingMinor).toBeNull();
    }
  });
});

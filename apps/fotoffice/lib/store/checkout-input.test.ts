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

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { CheckoutTotals } from "@/lib/pricing/pricing-engine";
import {
  applyPrepaidPrintCredit,
  normalizePrintSize,
  type CreditInputItem,
} from "./prepaid-print-credit";

const COMBO = { printUnits: 3, size: "15x21 cm", includesDigital: true };
const IMPRESA = 6500;
const DIGITAL_CON_IMPRESA = 3500;

/**
 * Carrito como lo arma la galería con "impresa + digital": por cada foto impresa, una
 * línea PRINT y una DIGITAL `includedWithPrint`. Precios del álbum 1045 sin el 15%.
 */
function carrito(n: number, opts: { size?: string; quantity?: number } = {}) {
  const items: CreditInputItem[] = [];
  const lines: CheckoutTotals["items"] = [];
  for (let i = 0; i < n; i++) {
    const fileKey = `photo:${100 + i}`;
    items.push({ fileKey, includedWithPrint: true });
    lines.push({
      inputIndex: items.length - 1,
      component: "DIGITAL",
      quantity: 1,
      unitPriceCents: DIGITAL_CON_IMPRESA,
      subtotalCents: DIGITAL_CON_IMPRESA,
      basePriceCents: 7000,
      pricingMode: "FIXED_MARKUP_TABLE",
    });
    const quantity = opts.quantity ?? 1;
    items.push({ fileKey, size: opts.size ?? "15x21 cm" });
    lines.push({
      inputIndex: items.length - 1,
      component: "PRINT",
      quantity,
      unitPriceCents: IMPRESA,
      subtotalCents: IMPRESA * quantity,
      basePriceCents: 4783,
      pricingMode: "FIXED_MARKUP_TABLE",
    });
  }
  const print = lines.filter((l) => l.component === "PRINT").reduce((s, l) => s + l.subtotalCents, 0);
  const digital = lines.filter((l) => l.component === "DIGITAL").reduce((s, l) => s + l.subtotalCents, 0);
  const totals: CheckoutTotals = {
    displayTotalCents: print + digital,
    mpTotalCents: print + digital,
    marketplaceFeeCents: 0,
    components: [
      { component: "DIGITAL", displayTotalCents: digital, mpTotalCents: digital, marketplaceFeeCents: 0 },
      { component: "PRINT", displayTotalCents: print, mpTotalCents: print, marketplaceFeeCents: 0 },
    ],
    items: lines,
    snapshot: { marketplaceFeePercent: 15, extensionSurchargeCents: 0, items: lines },
  };
  return { items, totals };
}

describe("applyPrepaidPrintCredit", () => {
  it("con exactamente 3 fotos el pedido queda en $0, impresas y digitales", () => {
    const { items, totals } = carrito(3);
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.equal(r.totals.displayTotalCents, 0);
    assert.equal(r.totals.marketplaceFeeCents, 0);
    assert.equal(r.creditedPrintUnits, 3);
    assert.ok(r.totals.items.every((l) => l.subtotalCents === 0));
  });

  it("con 4 fotos se cobra sólo la cuarta, impresa y su digital", () => {
    const { items, totals } = carrito(4);
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.equal(r.totals.displayTotalCents, IMPRESA + DIGITAL_CON_IMPRESA);
    assert.equal(r.discountArs, 3 * (IMPRESA + DIGITAL_CON_IMPRESA));
    const cuarta = r.totals.items.filter((l) => items[l.inputIndex].fileKey === "photo:103");
    assert.ok(cuarta.every((l) => l.subtotalCents > 0));
  });

  it("la comisión se recalcula sobre lo que efectivamente se cobra", () => {
    const { items, totals } = carrito(4);
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.ok(r.totals.marketplaceFeeCents > 0);
    assert.ok(r.totals.marketplaceFeeCents < r.totals.displayTotalCents);
  });

  it("con menos fotos que el combo cubre las que hay y no inventa crédito", () => {
    const { items, totals } = carrito(2);
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.equal(r.totals.displayTotalCents, 0);
    assert.equal(r.creditedPrintUnits, 2);
  });

  it("2 copias de una foto y 2 de otra: cubre 3 copias y cobra la cuarta", () => {
    const { items, totals } = carrito(2, { quantity: 2 });
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.equal(r.creditedPrintUnits, 3);
    // Los dos digitales van incluidos: las dos fotos tienen al menos una copia cubierta.
    assert.equal(r.totals.displayTotalCents, IMPRESA);
  });

  it("no cubre impresas de otro tamaño", () => {
    const { items, totals } = carrito(3, { size: "20x30 cm" });
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.equal(r.discountArs, 0);
    assert.equal(r.totals, totals);
  });

  it("no toca los digitales sueltos (los que no vienen con una impresa)", () => {
    const { items, totals } = carrito(3);
    items.push({ fileKey: "photo:999" });
    totals.items.push({
      inputIndex: items.length - 1,
      component: "DIGITAL",
      quantity: 1,
      unitPriceCents: 8050,
      subtotalCents: 8050,
      basePriceCents: 7000,
      pricingMode: "FIXED_MARKUP_TABLE",
    });
    totals.displayTotalCents += 8050;
    const r = applyPrepaidPrintCredit(totals, items, COMBO);
    assert.equal(r.totals.displayTotalCents, 8050);
  });

  it("normaliza los tamaños como los escriben los productos", () => {
    assert.equal(normalizePrintSize("15x21 cm"), "15x21");
    assert.equal(normalizePrintSize("15X21"), "15x21");
    assert.equal(normalizePrintSize(null), "");
  });
});

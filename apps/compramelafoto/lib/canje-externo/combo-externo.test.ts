import { test } from "node:test";
import assert from "node:assert/strict";
import { esComboExterno, resumenComboExterno } from "./combo-externo";

const regalo = {
  origin: "PREVENTA_PACK",
  redemptionPaymentRefsJson: {
    kind: "EXTERNAL_PREPAID_PRINT_CREDIT",
    isGift: true,
    label: "3 fotos impresas 15x20 de regalo",
  },
  redemptionOrderId: null,
};

test("el combo de regalo de una familia es un combo, no un pedido", () => {
  assert.equal(esComboExterno(regalo), true);
  assert.deepEqual(resumenComboExterno(regalo), {
    kind: "EXTERNAL_PREPAID_PRINT_CREDIT",
    titulo: "Combo de regalo",
    detalle: "3 fotos impresas 15x20 de regalo",
    pedidoId: null,
  });
});

test("un combo canjeado apunta al pedido con fotos", () => {
  const r = resumenComboExterno({ ...regalo, redemptionOrderId: 7001 });
  assert.equal(r?.pedidoId, 7001);
});

test("combo cobrado por fuera, pack externo y link compartido", () => {
  assert.equal(
    resumenComboExterno({ origin: "PREVENTA_PACK", redemptionPaymentRefsJson: { kind: "EXTERNAL_PREPAID_PRINT_CREDIT" } })
      ?.titulo,
    "Combo cobrado por fuera"
  );
  assert.equal(
    resumenComboExterno({ origin: "PREVENTA_PACK", redemptionPaymentRefsJson: { kind: "EXTERNAL_PREVENTA_PACK" } })?.titulo,
    "Pack cobrado por fuera"
  );
  const link = resumenComboExterno({
    origin: "PREVENTA_PACK",
    redemptionPaymentRefsJson: { kind: "EXTERNAL_SHARED_GIFT_LINK" },
    redemptionOrderId: 5,
  });
  assert.equal(link?.titulo, "Link compartido de regalo");
  assert.equal(link?.pedidoId, null);
});

test("los pedidos normales y las preventas pagadas no son combos", () => {
  assert.equal(esComboExterno({ origin: "STANDARD_CHECKOUT", redemptionPaymentRefsJson: null }), false);
  assert.equal(esComboExterno({ origin: "PREVENTA_PACK", redemptionPaymentRefsJson: null }), false);
  assert.equal(esComboExterno({ origin: "PREVENTA_PACK", redemptionPaymentRefsJson: { kind: "MP" } }), false);
  assert.equal(
    esComboExterno({ origin: "STANDARD_CHECKOUT", redemptionPaymentRefsJson: { kind: "EXTERNAL_PREPAID_PRINT_CREDIT" } }),
    false
  );
  assert.equal(esComboExterno({ origin: "PREVENTA_PACK", redemptionPaymentRefsJson: ["x"] }), false);
});

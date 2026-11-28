import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CANJE_SIN_CARGO_LABEL, formatCanjeAwareAmount, isCanjeOrder } from "./canje-order-label";

describe("isCanjeOrder", () => {
  it("reconoce el canje de un pack de preventa", () => {
    assert.equal(isCanjeOrder({ origin: "PACK_REDEMPTION", checkoutPaymentSource: "PREPAID_PACK" }), true);
  });

  it("reconoce el pedido cubierto por un combo cobrado por fuera", () => {
    assert.equal(isCanjeOrder({ origin: "STANDARD_CHECKOUT", checkoutPaymentSource: "PREPAID_PACK" }), true);
  });

  it("no toma como canje la compra del pack ni una venta normal", () => {
    assert.equal(isCanjeOrder({ origin: "PREVENTA_PACK", checkoutPaymentSource: "MERCADO_PAGO" }), false);
    assert.equal(isCanjeOrder({ origin: "STANDARD_CHECKOUT", checkoutPaymentSource: "MERCADO_PAGO" }), false);
    assert.equal(isCanjeOrder({}), false);
  });
});

describe("formatCanjeAwareAmount", () => {
  it("un canje en $0 dice que es sin cargo", () => {
    assert.equal(formatCanjeAwareAmount({ origin: "PACK_REDEMPTION" }, 0, "$ 0"), CANJE_SIN_CARGO_LABEL);
  });

  it("un canje con extras muestra lo cobrado y aclara que son extras", () => {
    assert.equal(formatCanjeAwareAmount({ origin: "PACK_REDEMPTION" }, 4500, "$ 4.500"), 
      "$ 4.500 (extras del canje)"
    );
  });

  it("una venta normal no cambia", () => {
    assert.equal(formatCanjeAwareAmount({ origin: "STANDARD_CHECKOUT" }, 0, "$ 0"), "$ 0");
  });
});

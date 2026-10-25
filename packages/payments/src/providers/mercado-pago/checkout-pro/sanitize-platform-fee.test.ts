import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMercadoPagoPaymentResponse } from "./sanitize";

test("copia sólo las dos cifras de la comisión de plataforma de la metadata", () => {
  const r = sanitizeMercadoPagoPaymentResponse({
    id: 1,
    metadata: { fo_comision_propia_minor: "200000", fo_retencion_minor: "230000", payer_email: "x@y.com", pedido_id: "p1" },
  });
  assert.deepEqual(r.platform_fee_metadata, { own_minor: "200000", withheld_minor: "230000" });
  assert.equal(JSON.stringify(r).includes("x@y.com"), false);
});

test("sin las dos cifras, o con algo que no son centavos, no copia nada", () => {
  assert.equal(sanitizeMercadoPagoPaymentResponse({ metadata: { fo_retencion_minor: "1" } }).platform_fee_metadata, null);
  assert.equal(sanitizeMercadoPagoPaymentResponse({ metadata: { fo_comision_propia_minor: "1,5", fo_retencion_minor: "2" } }).platform_fee_metadata, null);
  assert.equal(sanitizeMercadoPagoPaymentResponse({}).platform_fee_metadata, null);
});

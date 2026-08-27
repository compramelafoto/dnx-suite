import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryDnxPaymentsPersistence } from "@repo/payments/next";
import { createDurableDnxPaymentsClient } from "./durable-dnx-payments-client";

/**
 * Dos firmas distintas conviven en el mismo endpoint:
 *
 *   x-dnx-payments-signature → HMAC interno DNX, secreto NUESTRO
 *   x-signature              → firma de Mercado Pago, secreto de MP (su panel)
 *
 * Deben usar secretos separados. Si se comparten, el secreto que Mercado Pago
 * muestra en su panel habilita también la ruta interna de eventos normalizados,
 * que acredita inscripciones sin pasar por GET Order.
 */
describe("separación de secretos de webhook", () => {
  const persistence = createInMemoryDnxPaymentsPersistence();

  it("el HMAC interno usa el secreto DNX, no el de Mercado Pago", () => {
    const client = createDurableDnxPaymentsClient({
      persistence,
      webhookSecret: "secreto-interno-dnx",
      mercadoPagoWebhookSecret: "secreto-de-mercado-pago",
    });

    const rawBody = JSON.stringify({ eventId: "e1", orderId: "o1", sourceId: "s1" });
    const firma = client.signWebhook(rawBody);

    // Firmado con el secreto interno → aceptado.
    const conInterno = client.verifyWebhook(
      { "x-dnx-payments-signature": firma },
      rawBody,
    );
    assert.equal(conInterno.ok, false, "falta status → WEBHOOK_INVALID_BODY, no de firma");
    if (!conInterno.ok) {
      assert.notEqual(conInterno.code, "WEBHOOK_INVALID_SIGNATURE");
    }
  });

  it("una firma hecha con el secreto de Mercado Pago NO abre la ruta interna", async () => {
    const { createHmac } = await import("node:crypto");
    const client = createDurableDnxPaymentsClient({
      persistence,
      webhookSecret: "secreto-interno-dnx",
      mercadoPagoWebhookSecret: "secreto-de-mercado-pago",
    });

    const rawBody = JSON.stringify({
      eventId: "e2",
      orderId: "o2",
      sourceId: "s2",
      status: "APPROVED",
      amountMinor: 100000,
      currency: "ARS",
    });
    const firmaConSecretoMp = createHmac("sha256", "secreto-de-mercado-pago")
      .update(rawBody)
      .digest("hex");

    const result = client.verifyWebhook(
      { "x-dnx-payments-signature": firmaConSecretoMp },
      rawBody,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "WEBHOOK_INVALID_SIGNATURE");
  });

  it("sin secreto de Mercado Pago cae al interno (compatibilidad)", () => {
    const client = createDurableDnxPaymentsClient({
      persistence,
      webhookSecret: "secreto-unico-legacy",
    });
    // No debe romper la construcción ni la firma interna.
    assert.equal(typeof client.signWebhook("{}"), "string");
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paypalBaseUrl,
  createTopUpOrder,
  captureTopUpOrder,
  parseCustomId,
  usdCentsToPaypalValue,
} from "./paypal-dnx";

const env = { PAYPAL_DNX_CLIENT_ID: "id", PAYPAL_DNX_CLIENT_SECRET: "sec", PAYPAL_DNX_ENV: "sandbox" };

type Call = { url: string; init?: RequestInit };
function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const tokenOk = { status: 200, body: { access_token: "tok" } };

test("entorno de PayPal", () => {
  assert.equal(paypalBaseUrl("live"), "https://api-m.paypal.com");
  assert.equal(paypalBaseUrl(undefined), "https://api-m.sandbox.paypal.com");
  assert.equal(paypalBaseUrl("sandbox"), "https://api-m.sandbox.paypal.com");
});
test("monto con dos decimales", () => {
  assert.equal(usdCentsToPaypalValue(3500), "35.00");
  assert.equal(usdCentsToPaypalValue(1005), "10.05");
});
test("crea la orden de recarga en USD con el link de aprobación", async () => {
  const { impl, calls } = fakeFetch([
    tokenOk,
    { status: 201, body: { id: "PO-1", links: [{ rel: "payer-action", href: "https://pp/approve" }] } },
  ]);
  const r = await createTopUpOrder(
    { amountUsdCents: 3500, userId: 1038, chosenUsdCents: 1000, returnUrl: "https://r", cancelUrl: "https://c" },
    impl,
    env,
  );
  assert.deepEqual(r, { paypalOrderId: "PO-1", approveUrl: "https://pp/approve" });
  const body = JSON.parse(String(calls[1].init?.body));
  assert.equal(body.intent, "CAPTURE");
  assert.equal(body.purchase_units[0].amount.currency_code, "USD");
  assert.equal(body.purchase_units[0].amount.value, "35.00");
  assert.equal(body.purchase_units[0].custom_id, "1038:1000");
});
test("captura completa", async () => {
  const { impl } = fakeFetch([
    tokenOk,
    {
      status: 201,
      body: {
        status: "COMPLETED",
        purchase_units: [
          {
            custom_id: "1038:1000",
            payments: { captures: [{ id: "CAP-9", status: "COMPLETED", amount: { currency_code: "USD", value: "35.00" } }] },
          },
        ],
      },
    },
  ]);
  assert.deepEqual(await captureTopUpOrder("PO-1", impl, env), {
    status: "COMPLETED",
    captureId: "CAP-9",
    paidUsdCents: 3500,
    customId: "1038:1000",
  });
});
test("retorno repetido: la orden ya estaba capturada (Review Focus 3)", async () => {
  const { impl } = fakeFetch([
    tokenOk,
    { status: 422, body: { details: [{ issue: "ORDER_ALREADY_CAPTURED" }] } },
    {
      status: 200,
      body: {
        status: "COMPLETED",
        purchase_units: [
          {
            custom_id: "1038:1000",
            payments: { captures: [{ id: "CAP-9", status: "COMPLETED", amount: { currency_code: "USD", value: "35.00" } }] },
          },
        ],
      },
    },
  ]);
  assert.deepEqual(await captureTopUpOrder("PO-1", impl, env), {
    status: "ALREADY_CAPTURED",
    captureId: "CAP-9",
    paidUsdCents: 3500,
    customId: "1038:1000",
  });
});
test("captura rechazada", async () => {
  const { impl } = fakeFetch([tokenOk, { status: 422, body: { details: [{ issue: "INSTRUMENT_DECLINED" }] } }]);
  const r = await captureTopUpOrder("PO-1", impl, env);
  assert.equal(r.status, "FAILED");
  assert.equal(r.captureId, null);
});
test("custom_id", () => {
  assert.deepEqual(parseCustomId("1038:1000"), { userId: 1038, chosenUsdCents: 1000 });
  assert.equal(parseCustomId("x"), null);
  assert.equal(parseCustomId(null), null);
});

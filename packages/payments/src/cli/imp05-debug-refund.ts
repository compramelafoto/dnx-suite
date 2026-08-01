#!/usr/bin/env node
/**
 * Debug Orders refund 400 against sandbox (sanitized output).
 */
import { randomUUID } from "node:crypto";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MP_API_BASE_URL,
  moneyToMercadoPagoAmount,
  singleIntangibleItem,
} from "../providers/mercado-pago/index.js";
import { money } from "../money/index.js";
import { calculateDistribution } from "../distribution/index.js";

async function mint(publicKey: string): Promise<string> {
  const cardNumber = process.env.MERCADOPAGO_TEST_CARD_NUMBER!.replace(/\s+/g, "");
  const url = new URL(`${MP_API_BASE_URL}/v1/card_tokens`);
  url.searchParams.set("public_key", publicKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: cardNumber,
      expiration_month: Number(process.env.MERCADOPAGO_TEST_CARD_EXP_MONTH),
      expiration_year: Number(process.env.MERCADOPAGO_TEST_CARD_EXP_YEAR),
      security_code: process.env.MERCADOPAGO_TEST_CARD_SECURITY_CODE,
      cardholder: {
        name: process.env.MERCADOPAGO_TEST_CARDHOLDER_NAME ?? "APRO",
        identification: { type: "DNI", number: "12345678" },
      },
    }),
  });
  const j = (await res.json()) as { id?: string };
  if (!j.id) throw new Error("mint_failed");
  return j.id;
}

async function main() {
  const env = loadSandboxEnvFromProcess();
  if (!env.accessToken || !env.ownerUserId || !env.partnerReceiverId || !env.publicKey || !env.deviceId) {
    console.log(JSON.stringify({ ok: false, error: "env_incomplete" }));
    process.exitCode = 1;
    return;
  }
  const token = await mint(env.publicKey);
  const config = createMercadoPagoProviderConfig({
    accessToken: env.accessToken,
    environment: "sandbox",
    publicKey: env.publicKey,
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: env.ownerUserId,
    httpClient: http,
    verifyAfterCreate: true,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: "DNX TEST",
  });

  const total = money("ARS", 10_000n);
  const distribution = calculateDistribution({
    total,
    rules: [
      {
        recipientId: "owner",
        role: "OTHER",
        kind: "PERCENTAGE",
        percentageBps: 5000,
        priority: 1,
        optional: false,
      },
      {
        recipientId: "partner_a",
        role: "OTHER",
        kind: "PERCENTAGE",
        percentageBps: 5000,
        priority: 2,
        optional: false,
      },
    ],
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: ["owner", "partner_a"],
  });

  const created = await adapter.createSplitOrder({
    environment: "sandbox",
    externalReference: `imp05-rf-${randomUUID().slice(0, 8)}`,
    total,
    distribution,
    idempotencyKey: randomUUID(),
    deviceSessionId: env.deviceId,
    paymentToken: token,
    paymentMethodId: "master",
    installments: 1,
    payerEmail: "buyer.imp05@testuser.com",
    statementDescriptor: "DNX TEST",
    items: [singleIntangibleItem({ title: "Refund debug", total, categoryId: "others" })],
    partnerReceiverIds: new Map([["partner_a", env.partnerReceiverId]]),
    partnerConsentsByRecipientId: new Map([
      [
        "partner_a",
        {
          receiverId: env.partnerReceiverId,
          status: "ACTIVE",
          provider: "mercadopago",
        },
      ],
    ]),
  });

  const got = await adapter.getOrder(created.providerOrderId, "sandbox");
  const payId = got.payments[0]?.providerPaymentId;
  const partial = money("ARS", 2_000n);
  const partialBody = {
    transactions: [{ id: payId, amount: moneyToMercadoPagoAmount(partial) }],
  };

  async function tryRefund(
    label: string,
    init: { body?: string; contentType?: boolean },
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${env.accessToken!}`,
      "X-Idempotency-Key": randomUUID(),
      "x-test-token": "true",
    };
    if (init.contentType !== false) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(
      `${MP_API_BASE_URL}/v1/orders/${created.providerOrderId}/refund`,
      {
        method: "POST",
        headers,
        ...(init.body !== undefined ? { body: init.body } : {}),
      },
    );
    const rawText = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    return {
      label,
      httpStatus: res.status,
      status: typeof parsed?.status === "string" ? parsed.status : null,
      statusDetail:
        typeof parsed?.status_detail === "string" ? parsed.status_detail : null,
      errors: Array.isArray(parsed?.errors)
        ? parsed.errors.slice(0, 3)
        : Array.isArray(parsed?.causes)
          ? parsed.causes.slice(0, 3)
          : null,
      keys: parsed ? Object.keys(parsed).slice(0, 12) : [],
    };
  }

  await new Promise((r) => setTimeout(r, 2000));

  const partialOnly = process.argv.includes("--partial-only");
  const attempts = partialOnly ? [
    await tryRefund("partial_json", { body: JSON.stringify(partialBody) }),
  ] : [
    await tryRefund("partial_json", { body: JSON.stringify(partialBody) }),
    await tryRefund("total_empty_string", { body: "" }),
    await tryRefund("total_empty_object", { body: "{}" }),
    await tryRefund("total_no_body", { contentType: false }),
  ];

  console.log(
    JSON.stringify(
      {
        createStatus: created.status,
        getStatus: got.status,
        getStatusDetail: got.statusDetail ?? null,
        orderIdPrefix: `${created.providerOrderId.slice(0, 12)}…`,
        payIdPrefix: payId ? `${payId.slice(0, 12)}…` : null,
        payIdLen: payId?.length ?? 0,
        amount: partialBody.transactions[0]?.amount,
        attempts,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e).slice(0, 300) }));
  process.exitCode = 1;
});

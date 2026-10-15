import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryDnxPaymentsPersistence } from "../../persistence/memory.js";
import type { CreateSplitOrderInput } from "../../../providers/mercado-pago/orders/adapter.js";
import { buildSplitEntriesFromDistribution } from "../../../providers/mercado-pago/orders/mapper.js";
import { createClickatonCheckoutService } from "./clickaton-checkout-service.js";
import {
  createMercadoPagoOrdersAffiliateSplitBridge,
  createProductionAffiliateSplitOrdersAdapter,
  deriveMercadoPagoIdempotencyKey,
  mapAffiliateSplitOrderStatus,
  type AffiliateSplitOrdersAdapterPort,
} from "./orders-1n-affiliate-split-bridge.js";
import {
  createClickatonAffiliateSplitCompositeBridge,
  isMercadoPagoOrdersProviderId,
} from "./affiliate-split-composite-bridge.js";
import type { ClickatonCheckoutProviderBridge } from "./types.js";

const RECEIVER = "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";
const OWNER = "97484805";
const PA = "pa_ba733fa7a35f4326";

type BridgeCreateInput = Parameters<ClickatonCheckoutProviderBridge["createCheckout"]>[0];

function baseCreateInput(overrides: Partial<BridgeCreateInput> = {}): BridgeCreateInput {
  return {
    orderId: "dnx_ord_1",
    amountMinor: 2_500_000,
    currency: "ARS",
    description: "Inscripción Clickatón — CK-00001",
    externalReference: "clickaton-registration-reg_1",
    idempotencyKey: "clickaton:reg:reg_1:pay:abc12345:a1:split:deadbeef",
    payloadHash: "f".repeat(64),
    payerEmail: "comprador@example.com",
    successUrl: "https://clickaton.com/ok",
    pendingUrl: "https://clickaton.com/pending",
    failureUrl: "https://clickaton.com/error",
    sourceId: "reg_1",
    collectorAccessToken: "APP_USR-collector",
    collectorPaymentAccountId: PA,
    cardPayment: {
      token: "card_tok_1",
      paymentMethodId: "master",
      installments: 1,
      deviceSessionId: "armor.device.session",
      payer: {
        email: "comprador@example.com",
        identification: { type: "DNI", number: "30111222" },
      },
    },
    affiliateSplit: {
      recipientId: "rcp_affiliate_1",
      receiverId: RECEIVER,
      partnerAmountMinor: 230_000,
    },
    payerName: { firstName: "Ana", lastName: "Pérez" },
    ...overrides,
  };
}

function fakeAdapter(status = "PROCESSED_ACCREDITED") {
  const calls: { tokens: string[]; create: CreateSplitOrderInput[]; get: string[] } = {
    tokens: [],
    create: [],
    get: [],
  };
  const createAdapter = (token: string): AffiliateSplitOrdersAdapterPort => {
    calls.tokens.push(token);
    return {
      async createSplitOrder(input: CreateSplitOrderInput) {
        calls.create.push(input);
        return {
          providerOrderId: "ORD01TESTAFFILIATE",
          status,
          raw: { id: "ORD01TESTAFFILIATE", status_detail: "accredited" },
        };
      },
      async getOrder(providerOrderId: string) {
        calls.get.push(providerOrderId);
        return { providerOrderId, status, payments: [], statusDetail: "accredited" };
      },
    } as unknown as AffiliateSplitOrdersAdapterPort;
  };
  return { calls, createAdapter };
}

describe("Orders 1:N affiliate split bridge (production)", () => {
  it("builds a production split order: owner remainder + affiliate fixed amount", async () => {
    const fake = fakeAdapter();
    const bridge = createMercadoPagoOrdersAffiliateSplitBridge({
      createAdapter: fake.createAdapter,
      ownerUserId: OWNER,
      resolveReadAccessToken: () => "APP_USR-read",
      expectedCollectorPaymentAccountId: PA,
    });
    assert.equal(bridge.mode, "mercado_pago_production");

    const out = await bridge.createCheckout(baseCreateInput());
    assert.equal(fake.calls.tokens[0], "APP_USR-collector");
    const req = fake.calls.create[0]!;
    assert.equal(req.environment, "production");
    assert.equal(req.externalReference, "clickaton-registration-reg_1");
    assert.equal(req.total.amountMinor, 2_500_000n);
    assert.equal(req.paymentToken, "card_tok_1");
    assert.equal(req.paymentMethodId, "master");
    assert.equal(req.deviceSessionId, "armor.device.session");
    assert.equal(req.statementDescriptor, "CLICKATON");
    assert.equal(req.payerEmail, "comprador@example.com");
    assert.deepEqual(req.payerProfile, {
      firstName: "Ana",
      lastName: "Pérez",
      identification: { type: "DNI", number: "30111222" },
    });
    // Idempotencia MP: UUID determinístico (sin ':').
    assert.equal(req.idempotencyKey, deriveMercadoPagoIdempotencyKey(baseCreateInput().idempotencyKey));
    assert.match(req.idempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);

    // Consentimiento real: sin fixture de prueba.
    const consent = req.partnerConsentsByRecipientId.get("rcp_affiliate_1");
    assert.deepEqual(consent, { receiverId: RECEIVER, status: "ACTIVE", provider: "mercadopago" });
    assert.equal(req.partnerReceiverIds.get("rcp_affiliate_1"), RECEIVER);

    // Entradas que verá MP: dueño 97484805 con el resto, afiliado con su fijo.
    const entries = buildSplitEntriesFromDistribution(req.distribution, OWNER, req.partnerReceiverIds, {
      partnerConsentsByRecipientId: req.partnerConsentsByRecipientId,
      amountType: "fixed",
    });
    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((e) => [e.receiverType, e.receiverId, e.amount?.amountMinor]),
      [
        ["owner", OWNER, 2_270_000n],
        ["partner", RECEIVER, 230_000n],
      ],
    );

    assert.equal(out.providerOrderId, "ORD01TESTAFFILIATE");
    assert.equal(out.immediateStatus, "APPROVED");
    assert.equal(out.checkoutUrl, "https://clickaton.com/ok");
    assert.equal(out.rawSanitized.liveMode, true);
    assert.equal(JSON.stringify(out.rawSanitized).includes("card_tok_1"), false);
    assert.equal(JSON.stringify(out.rawSanitized).includes("APP_USR"), false);
  });

  it("rejects missing card, missing split, bad amounts and foreign collector", async () => {
    const fake = fakeAdapter();
    const bridge = createMercadoPagoOrdersAffiliateSplitBridge({
      createAdapter: fake.createAdapter,
      ownerUserId: OWNER,
      resolveReadAccessToken: () => "APP_USR-read",
      expectedCollectorPaymentAccountId: PA,
    });
    await assert.rejects(bridge.createCheckout(baseCreateInput({ affiliateSplit: undefined })), /AFFILIATE_SPLIT_REQUIRED/);
    await assert.rejects(bridge.createCheckout(baseCreateInput({ cardPayment: undefined })), /CARD_PAYMENT_REQUIRED/);
    for (const partnerAmountMinor of [0, -1, 2_500_000, 3_000_000, 1.5]) {
      await assert.rejects(
        bridge.createCheckout(
          baseCreateInput({
            affiliateSplit: { recipientId: "rcp_affiliate_1", receiverId: RECEIVER, partnerAmountMinor },
          }),
        ),
        /AFFILIATE_SPLIT_INVALID_AMOUNT/,
      );
    }
    await assert.rejects(
      bridge.createCheckout(baseCreateInput({ collectorPaymentAccountId: "pa_other" })),
      /COLLECTOR_MISMATCH/,
    );
    await assert.rejects(
      bridge.createCheckout(baseCreateInput({ collectorAccessToken: undefined })),
      /collector_token_required/,
    );
    assert.equal(fake.calls.create.length, 0);
  });

  it("refresh reads the order in production with live mode", async () => {
    const fake = fakeAdapter("PROCESSED_ACCREDITED");
    const bridge = createMercadoPagoOrdersAffiliateSplitBridge({
      createAdapter: fake.createAdapter,
      ownerUserId: OWNER,
      resolveReadAccessToken: () => "APP_USR-read",
    });
    const got = await bridge.refreshCheckout!({
      providerOrderId: "ORD01TESTAFFILIATE",
      externalReference: "clickaton-registration-reg_1",
      expectedAmountMinor: 2_500_000,
      expectedCurrency: "ARS",
    });
    assert.equal(fake.calls.tokens[0], "APP_USR-read");
    assert.equal(got?.status, "APPROVED");
    assert.equal(got?.liveMode, true);
    assert.equal(got?.amountMinor, 2_500_000);
  });

  it("maps order statuses", () => {
    assert.equal(mapAffiliateSplitOrderStatus("PROCESSED"), "APPROVED");
    assert.equal(mapAffiliateSplitOrderStatus("FAILED"), "REJECTED");
    assert.equal(mapAffiliateSplitOrderStatus("REFUNDED"), "REFUNDED");
    assert.equal(mapAffiliateSplitOrderStatus("CHARGED_BACK"), "CHARGEBACK");
    assert.equal(mapAffiliateSplitOrderStatus("CANCELED"), "CANCELLED");
    assert.equal(mapAffiliateSplitOrderStatus("OPEN"), "PROCESSING");
    assert.equal(mapAffiliateSplitOrderStatus("UNKNOWN:action_required:"), "PENDING");
  });
});

describe("Affiliate split bridge with the real Orders adapter (fake fetch)", () => {
  it("passes validation and POSTs a production /v1/orders with owner + partner splits", async () => {
    const requests: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      requests.push({
        url: String(url),
        method: init?.method ?? "GET",
        headers,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        JSON.stringify({ id: "ORD01REALADAPTER", status: "processed", status_detail: "accredited" }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const bridge = createMercadoPagoOrdersAffiliateSplitBridge({
      createAdapter: (token) =>
        createProductionAffiliateSplitOrdersAdapter({ accessToken: token, ownerUserId: OWNER, fetchImpl }),
      ownerUserId: OWNER,
      resolveReadAccessToken: () => "APP_USR-read",
      expectedCollectorPaymentAccountId: PA,
    });
    const out = await bridge.createCheckout(baseCreateInput());
    assert.equal(out.providerOrderId, "ORD01REALADAPTER");
    assert.equal(out.immediateStatus, "APPROVED");

    assert.equal(requests.length, 1);
    const req = requests[0]!;
    assert.equal(req.method, "POST");
    assert.match(req.url, /\/v1\/orders$/);
    assert.equal(req.headers["x-test-token"], undefined);
    assert.equal(req.headers["authorization"], "Bearer APP_USR-collector");
    assert.equal(req.headers["x-meli-session-id"], "armor.device.session");
    const body = req.body as {
      external_reference: string;
      total_amount: string;
      payer: { email: string; identification?: unknown };
      splits?: Array<Record<string, unknown>>;
    };
    assert.equal(body.external_reference, "clickaton-registration-reg_1");
    assert.equal(body.total_amount, "25000.00");
    assert.equal(body.payer.email, "comprador@example.com");
    assert.deepEqual(body.payer.identification, { type: "DNI", number: "30111222" });
    const serialized = JSON.stringify(body);
    assert.ok(serialized.includes(OWNER));
    assert.ok(serialized.includes(RECEIVER));
    assert.ok(serialized.includes("22700.00"));
    assert.ok(serialized.includes("2300.00"));
  });
});

function recordingBridge(name: string, mode: ClickatonCheckoutProviderBridge["mode"]) {
  const calls: string[] = [];
  const bridge: ClickatonCheckoutProviderBridge = {
    mode,
    providerName: name === "pro" ? "mercadopago_preferences_legacy" : "mercadopago",
    async createCheckout() {
      calls.push("create");
      return { checkoutUrl: `https://x/${name}`, providerOrderId: `${name}_1`, rawSanitized: {} };
    },
    async refreshCheckout(input) {
      calls.push(`refresh:${input.providerOrderId}`);
      return {
        status: "PENDING",
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
        externalReference: input.externalReference,
        liveMode: true,
        rawSanitized: {},
      };
    },
    async fetchPaymentById(id) {
      calls.push(`payment:${id}`);
      return null;
    },
  };
  return { bridge, calls };
}

describe("Affiliate split composite bridge", () => {
  it("routes create / refresh / payment lookups", async () => {
    const pro = recordingBridge("pro", "mercado_pago_production");
    const split = recordingBridge("split", "mercado_pago_production");
    const composite = createClickatonAffiliateSplitCompositeBridge({
      checkoutPro: pro.bridge,
      ordersSplit: split.bridge,
    });
    assert.equal(composite.mode, "mercado_pago_production");
    assert.equal(composite.providerName, "mercadopago_preferences_legacy");

    const noCard = baseCreateInput({ cardPayment: undefined, affiliateSplit: undefined });
    assert.equal((await composite.createCheckout(noCard)).providerOrderId, "pro_1");
    assert.equal((await composite.createCheckout(baseCreateInput())).providerOrderId, "split_1");
    await assert.rejects(
      composite.createCheckout(baseCreateInput({ affiliateSplit: undefined })),
      /CARD_PAYMENT_WITHOUT_AFFILIATE_SPLIT/,
    );

    const refresh = (providerOrderId: string) =>
      composite.refreshCheckout!({
        providerOrderId,
        externalReference: "x",
        expectedAmountMinor: 1,
        expectedCurrency: "ARS",
      });
    await refresh("ORD01ABC");
    await refresh("ord01abc");
    await refresh("123456789");
    await refresh("97484805-pref-abc");
    await composite.fetchPaymentById!("555");

    assert.deepEqual(split.calls, ["create", "refresh:ORD01ABC", "refresh:ord01abc"]);
    assert.deepEqual(pro.calls, [
      "create",
      "refresh:123456789",
      "refresh:97484805-pref-abc",
      "payment:555",
    ]);
    assert.equal(isMercadoPagoOrdersProviderId("ORD1"), true);
    assert.equal(isMercadoPagoOrdersProviderId("1234"), false);
  });

  it("refuses a non-production Checkout Pro bridge", () => {
    const test = recordingBridge("pro", "mercado_pago_test");
    const split = recordingBridge("split", "mercado_pago_production");
    assert.throws(() =>
      createClickatonAffiliateSplitCompositeBridge({ checkoutPro: test.bridge, ordersSplit: split.bridge }),
    );
  });
});

describe("Checkout service with affiliate split", () => {
  function capturingManualBridge() {
    const seen: BridgeCreateInput[] = [];
    const bridge: ClickatonCheckoutProviderBridge = {
      mode: "manual",
      providerName: "manual",
      async createCheckout(input) {
        seen.push(input);
        return { checkoutUrl: "https://payments.test/x", providerOrderId: `fake_${input.orderId}`, rawSanitized: {} };
      },
    };
    return { bridge, seen };
  }

  const orderInput = {
    sourceApp: "CLICKATON" as const,
    sourceType: "REGISTRATION" as const,
    sourceId: "reg_9",
    payloadHash: "a".repeat(64),
    amountMinor: 1000,
    currency: "ARS" as const,
    description: "x",
    successUrl: "https://c/ok",
    pendingUrl: "https://c/p",
    failureUrl: "https://c/e",
  };

  it("uses the hyphen external reference and forwards the split only with card + split", async () => {
    const { bridge, seen } = capturingManualBridge();
    const service = createClickatonCheckoutService(createInMemoryDnxPaymentsPersistence(), {
      providerBridge: bridge,
    });
    const split = await service.createOrder({
      ...orderInput,
      idempotencyKey: "k-split",
      cardPayment: baseCreateInput().cardPayment!,
      affiliateSplit: { recipientId: "rcp_1", receiverId: RECEIVER, partnerAmountMinor: 100 },
      payerName: { firstName: "Ana" },
    });
    assert.equal(split.outcome, "created");
    assert.equal(seen[0]!.externalReference, "clickaton-registration-reg_9");
    assert.deepEqual(seen[0]!.affiliateSplit, {
      recipientId: "rcp_1",
      receiverId: RECEIVER,
      partnerAmountMinor: 100,
    });
    assert.deepEqual(seen[0]!.payerName, { firstName: "Ana" });
    if (split.outcome === "created") assert.equal(split.order.sourceId, "reg_9");
  });

  it("keeps the colon reference and sends no split fields otherwise", async () => {
    const { bridge, seen } = capturingManualBridge();
    const service = createClickatonCheckoutService(createInMemoryDnxPaymentsPersistence(), {
      providerBridge: bridge,
    });
    await service.createOrder({
      ...orderInput,
      sourceId: "reg_10",
      idempotencyKey: "k-plain",
      payerName: { firstName: "Ana" },
      affiliateSplit: { recipientId: "rcp_1", receiverId: RECEIVER, partnerAmountMinor: 100 },
    });
    assert.equal(seen[0]!.externalReference, "clickaton:registration:reg_10");
    assert.equal("affiliateSplit" in seen[0]!, false);
    assert.equal("payerName" in seen[0]!, false);
  });
});

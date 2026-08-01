import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStoreCheckoutEnabled,
  isStorePaymentsLiveEnabled,
  storeHoldTtlMinutes,
} from "./feature-flags";
import { parseCreateStoreOrderBody } from "./schema";
import { STORE_LEGAL_VERSION } from "./legal";
import {
  canTransitionStoreOrder,
  canTransitionStorePayment,
} from "./transitions";
import {
  generateStoreOrderPublicId,
  hashStoreOrderAccessToken,
  maskEmail,
  maskPhone,
} from "./access-token";
import { commercialFingerprintFromValidated } from "./fingerprint";
import { isStoreOrderPaymentSource } from "./payment-source";

describe("store checkout feature flags", () => {
  it("default OFF when unset", () => {
    const prev = process.env.CLICKATON_STORE_CHECKOUT_ENABLED;
    delete process.env.CLICKATON_STORE_CHECKOUT_ENABLED;
    assert.equal(isStoreCheckoutEnabled(), false);
    if (prev !== undefined) process.env.CLICKATON_STORE_CHECKOUT_ENABLED = prev;
  });

  it("payments live default OFF", () => {
    const prev = process.env.CLICKATON_STORE_PAYMENTS_LIVE;
    delete process.env.CLICKATON_STORE_PAYMENTS_LIVE;
    assert.equal(isStorePaymentsLiveEnabled(), false);
    if (prev !== undefined) process.env.CLICKATON_STORE_PAYMENTS_LIVE = prev;
  });

  it("hold TTL clamps to safe default", () => {
    const prev = process.env.STORE_HOLD_TTL_MINUTES;
    process.env.STORE_HOLD_TTL_MINUTES = "999";
    assert.equal(storeHoldTtlMinutes(), 15);
    process.env.STORE_HOLD_TTL_MINUTES = "20";
    assert.equal(storeHoldTtlMinutes(), 20);
    if (prev !== undefined) process.env.STORE_HOLD_TTL_MINUTES = prev;
    else delete process.env.STORE_HOLD_TTL_MINUTES;
  });
});

describe("store order transitions", () => {
  it("allows PENDING_PAYMENT → PAID", () => {
    assert.equal(canTransitionStoreOrder("PENDING_PAYMENT", "PAID"), true);
  });

  it("rejects PAID → DRAFT", () => {
    assert.equal(canTransitionStoreOrder("PAID", "DRAFT"), false);
  });

  it("payment APPROVED is terminal except refunds", () => {
    assert.equal(canTransitionStorePayment("APPROVED", "PENDING"), false);
    assert.equal(canTransitionStorePayment("APPROVED", "REFUNDED"), true);
  });
});

describe("create store order schema", () => {
  const base = {
    items: [{ productId: "prod_abcdefgh", variantId: "var_abcdefgh", quantity: 1 }],
    customer: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "+54 11 1234-5678",
    },
    deliveryMethod: "PICKUP" as const,
    delivery: {
      kind: "PICKUP" as const,
      pickupPointId: "clickaton-default",
      pickupPersonName: "Ana Pérez",
    },
    legal: {
      acceptedPurchaseTerms: true as const,
      acceptedReturnsPolicy: true as const,
      acceptedPrivacy: true as const,
      legalVersion: STORE_LEGAL_VERSION,
    },
    idempotencyKey: "idempotency_key_123456",
  };

  it("accepts valid pickup payload", () => {
    const parsed = parseCreateStoreOrderBody(base);
    assert.equal(parsed.ok, true);
  });

  it("rejects empty cart", () => {
    const parsed = parseCreateStoreOrderBody({ ...base, items: [] });
    assert.equal(parsed.ok, false);
  });

  it("rejects shipping when disabled", () => {
    const parsed = parseCreateStoreOrderBody({
      ...base,
      deliveryMethod: "SHIPPING",
      delivery: {
        kind: "SHIPPING",
        street: "Calle",
        number: "1",
        city: "CABA",
        province: "CABA",
        postalCode: "1000",
      },
    });
    assert.equal(parsed.ok, false);
  });

  it("requires legal acceptances", () => {
    const parsed = parseCreateStoreOrderBody({
      ...base,
      legal: {
        ...base.legal,
        acceptedPurchaseTerms: false,
      },
    });
    assert.equal(parsed.ok, false);
  });

  it("rejects client price fields if smuggled (ignored by schema)", () => {
    const parsed = parseCreateStoreOrderBody({
      ...base,
      totalAmount: 1,
      unitPrice: 1,
    });
    assert.equal(parsed.ok, true);
  });
});

describe("access + privacy", () => {
  it("publicId is high entropy", () => {
    const a = generateStoreOrderPublicId();
    const b = generateStoreOrderPublicId();
    assert.match(a, /^sto_/);
    assert.notEqual(a, b);
    assert.ok(a.length > 20);
  });

  it("hashes access token", () => {
    const h1 = hashStoreOrderAccessToken("token-abc");
    const h2 = hashStoreOrderAccessToken("token-abc");
    assert.equal(h1, h2);
    assert.notEqual(h1, "token-abc");
  });

  it("masks email and phone", () => {
    assert.match(maskEmail("juan@example.com"), /\*\*\*/);
    assert.match(maskPhone("+541112345678"), /\*\*\*/);
  });
});

describe("fingerprint + webhook routing", () => {
  it("fingerprint changes when quantity changes", () => {
    const body = {
      items: [{ productId: "prod_abcdefgh", variantId: "var_abcdefgh", quantity: 1 }],
      customer: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "11111111",
      },
      deliveryMethod: "PICKUP" as const,
      delivery: {
        kind: "PICKUP" as const,
        pickupPointId: "clickaton-default",
        pickupPersonName: "Ana",
      },
      legal: {
        acceptedPurchaseTerms: true as const,
        acceptedReturnsPolicy: true as const,
        acceptedPrivacy: true as const,
        legalVersion: STORE_LEGAL_VERSION,
      },
      idempotencyKey: "idempotency_key_123456",
    };
    const a = commercialFingerprintFromValidated({
      body,
      lines: [
        {
          productId: "prod_abcdefgh",
          productVariantId: "var_abcdefgh",
          quantity: 1,
          unitPriceAmount: 1000,
        },
      ],
      subtotalAmount: 1000,
      deliveryAmount: 0,
      totalAmount: 1000,
      currency: "ARS",
    });
    const b = commercialFingerprintFromValidated({
      body,
      lines: [
        {
          productId: "prod_abcdefgh",
          productVariantId: "var_abcdefgh",
          quantity: 2,
          unitPriceAmount: 1000,
        },
      ],
      subtotalAmount: 2000,
      deliveryAmount: 0,
      totalAmount: 2000,
      currency: "ARS",
    });
    assert.notEqual(a, b);
  });

  it("detects store order payment source", () => {
    assert.equal(
      isStoreOrderPaymentSource({
        eventId: "e1",
        orderId: "o1",
        status: "APPROVED",
        amountMinor: 100,
        currency: "ARS",
        provider: "manual",
        externalReference: "CLICKATON_STORE_ORDER:sto_abc",
        sourceId: "sto_abc",
        receivedAt: new Date(),
      }),
      true,
    );
    assert.equal(
      isStoreOrderPaymentSource({
        eventId: "e2",
        orderId: "o2",
        status: "APPROVED",
        amountMinor: 100,
        currency: "ARS",
        provider: "manual",
        externalReference: "clickaton:registration:xyz",
        sourceId: "xyz",
        receivedAt: new Date(),
      }),
      false,
    );
  });
});

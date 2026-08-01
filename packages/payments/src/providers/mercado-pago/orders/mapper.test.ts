import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../../money/index.js";
import { calculateDistribution } from "../../../distribution/calculate.js";
import {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  mapMercadoPagoOrderStatus,
  resolveMpAmountType,
  stablePayloadHash,
} from "./mapper.js";
import {
  FAKE_OWNER_USER_ID,
  FAKE_PARTNER_RECEIVER_ID,
  FAKE_PARTNER_RECEIVER_ID_2,
} from "../testing/fixtures.js";
import { testActivePartnerConsent } from "./consent-evidence.js";
import { singleIntangibleItem } from "./order-items.js";
import { TEST_DEVICE_SESSION_ID } from "./test-helpers.js";

describe("orders mapper", () => {
  it("buildMercadoPagoSplitOrderRequest builds fixed splits with homologation fields", () => {
    const total = money("ARS", 100_000n);
    const req = buildMercadoPagoSplitOrderRequest({
      externalReference: "dnx-order-ref-1",
      total,
      amountType: "fixed",
      deviceSessionId: TEST_DEVICE_SESSION_ID,
      payerEmail: "test_buyer@testuser.com",
      statementDescriptor: "DNX",
      items: [singleIntangibleItem({ title: "Servicio intangible", total, categoryId: "others" })],
      paymentToken: "TEST_TOKEN",
      paymentMethodId: "visa",
      entries: [
        { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amount: money("ARS", 70_000n) },
        {
          receiverType: "partner",
          receiverId: FAKE_PARTNER_RECEIVER_ID,
          consentStatus: "ACTIVE",
          amount: money("ARS", 30_000n),
        },
      ],
    });
    assert.equal(req.body.type, "online");
    assert.equal(req.body.total_amount, "1000.00");
    assert.equal(req.body.payer?.email, "test_buyer@testuser.com");
    assert.equal(req.body.splits.length, 2);
    assert.equal(req.body.splits[0]?.amount, "700.00");
    assert.equal(req.body.splits[1]?.amount, "300.00");
    assert.equal(req.body.config.split_rules.amount_type, "fixed");
    assert.equal(req.headers["x-meli-session-id"], TEST_DEVICE_SESSION_ID);
    // Imp 05 sandbox: items at top-level; additional_info.items rejected by MP
    assert.equal(req.body.items?.[0]?.unit_price, "1000.00");
    assert.equal(req.body.items?.[0]?.quantity, 1);
    assert.equal(req.body.items?.[0]?.title, "Servicio intangible");
    assert.equal(req.body.additional_info, undefined);
    assert.equal(
      req.body.transactions?.payments?.[0]?.payment_method?.statement_descriptor,
      "DNX",
    );
  });

  it("fixed_preferred converts percentage rules to fixed MP amounts with exact sum", () => {
    const total = money("ARS", 10_000n); // $100.00
    const distribution = calculateDistribution({
      total,
      rules: [
        {
          recipientId: "owner-role",
          role: "PLATFORM",
          kind: "PERCENTAGE",
          percentageBps: 9000,
          priority: 1,
          optional: false,
        },
        {
          recipientId: "partner-a",
          role: "PHOTOGRAPHER",
          kind: "PERCENTAGE",
          percentageBps: 1000,
          priority: 2,
          optional: false,
        },
      ],
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["owner-role", "partner-a"],
    });

    const amountType = resolveMpAmountType(distribution, "fixed_preferred");
    assert.equal(amountType, "fixed");

    const partnerReceiverIds = new Map([["partner-a", FAKE_PARTNER_RECEIVER_ID]]);
    const partnerConsentsByRecipientId = new Map([
      ["partner-a", testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID)],
    ]);
    const entries = buildSplitEntriesFromDistribution(
      distribution,
      FAKE_OWNER_USER_ID,
      partnerReceiverIds,
      { partnerConsentsByRecipientId, amountType },
    );

    const sum = entries.reduce((acc, e) => acc + (e.amount?.amountMinor ?? 0n), 0n);
    assert.equal(sum, total.amountMinor);
    assert.equal(entries.every((e) => e.amount != null), true);

    const req = buildMercadoPagoSplitOrderRequest({
      externalReference: "dnx-fixed-pref-100",
      total,
      amountType,
      entries,
      deviceSessionId: TEST_DEVICE_SESSION_ID,
      payerEmail: "test_buyer@testuser.com",
      statementDescriptor: "DNX",
      items: [singleIntangibleItem({ title: "Item", total })],
      paymentToken: "TEST_TOKEN",
      paymentMethodId: "visa",
    });
    assert.equal(req.body.config.split_rules.amount_type, "fixed");
    const splitSum = req.body.splits.reduce((acc, s) => acc + Number(s.amount), 0);
    assert.equal(splitSum.toFixed(2), "100.00");
  });

  it("handles centavos and 3 receivers with exact fixed sum", () => {
    const total = money("ARS", 10_001n); // $100.01
    const distribution = calculateDistribution({
      total,
      rules: [
        {
          recipientId: "a",
          role: "OTHER",
          kind: "PERCENTAGE",
          percentageBps: 3334,
          priority: 1,
          optional: false,
        },
        {
          recipientId: "b",
          role: "OTHER",
          kind: "PERCENTAGE",
          percentageBps: 3333,
          priority: 2,
          optional: false,
        },
        {
          recipientId: "c",
          role: "OTHER",
          kind: "PERCENTAGE",
          percentageBps: 3333,
          priority: 3,
          optional: false,
        },
      ],
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["a", "b", "c"],
    });

    const amountType = resolveMpAmountType(distribution, "fixed_preferred");
    const partnerReceiverIds = new Map([
      ["b", FAKE_PARTNER_RECEIVER_ID],
      ["c", FAKE_PARTNER_RECEIVER_ID_2],
    ]);
    const partnerConsentsByRecipientId = new Map([
      ["b", testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID)],
      ["c", testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID_2)],
    ]);
    const entries = buildSplitEntriesFromDistribution(
      distribution,
      FAKE_OWNER_USER_ID,
      partnerReceiverIds,
      { partnerConsentsByRecipientId, amountType },
    );
    const sum = entries.reduce((acc, e) => acc + (e.amount?.amountMinor ?? 0n), 0n);
    assert.equal(sum, 10_001n);
  });

  it("mapMercadoPagoOrderStatus maps processed+accredited", () => {
    assert.equal(mapMercadoPagoOrderStatus("processed", "accredited"), "PROCESSED_ACCREDITED");
  });

  it("mapMercadoPagoOrderStatus maps open+waiting_payment", () => {
    assert.equal(mapMercadoPagoOrderStatus("open", "waiting_payment"), "OPEN");
  });

  it("mapMercadoPagoOrderStatus marks unknown", () => {
    assert.match(mapMercadoPagoOrderStatus("weird", "x"), /^UNKNOWN:/);
  });

  it("stablePayloadHash is deterministic with sorted keys", () => {
    const a = stablePayloadHash({ z: 1, a: { c: 2, b: 1 } });
    const b = stablePayloadHash({ a: { b: 1, c: 2 }, z: 1 });
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });
});

/**
 * Structural homologation snapshot — no secrets, no real tokens.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../../money/index.js";
import { calculateDistribution } from "../../../distribution/calculate.js";
import {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  resolveMpAmountType,
} from "./mapper.js";
import { validateMercadoPagoSplitOrder } from "./validator.js";
import { testActivePartnerConsent } from "./consent-evidence.js";
import { singleIntangibleItem } from "./order-items.js";
import { buildOpaqueExternalReference } from "./external-reference.js";
import {
  FAKE_OWNER_USER_ID,
  FAKE_PARTNER_RECEIVER_ID,
  FAKE_PARTNER_RECEIVER_ID_2,
} from "../testing/fixtures.js";
import { TEST_DEVICE_SESSION_ID } from "./test-helpers.js";
import { MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS } from "./constants.js";

describe("homologation payload snapshot (sanitized)", () => {
  it("builds owner + 2 partners ARS 100000 fixed order shape", () => {
    const total = money("ARS", 100_000n);
    const distribution = calculateDistribution({
      total,
      rules: [
        {
          recipientId: "owner-share",
          role: "PLATFORM",
          kind: "PERCENTAGE",
          percentageBps: 5000,
          priority: 1,
          optional: false,
        },
        {
          recipientId: "partner-a",
          role: "PHOTOGRAPHER",
          kind: "PERCENTAGE",
          percentageBps: 3000,
          priority: 2,
          optional: false,
        },
        {
          recipientId: "partner-b",
          role: "ORGANIZER",
          kind: "PERCENTAGE",
          percentageBps: 2000,
          priority: 3,
          optional: false,
        },
      ],
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["owner-share", "partner-a", "partner-b"],
    });

    const partnerReceiverIds = new Map([
      ["partner-a", FAKE_PARTNER_RECEIVER_ID],
      ["partner-b", FAKE_PARTNER_RECEIVER_ID_2],
    ]);
    const partnerConsentsByRecipientId = new Map([
      ["partner-a", testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID)],
      ["partner-b", testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID_2)],
    ]);

    const amountType = resolveMpAmountType(distribution, "fixed_preferred");
    const entries = buildSplitEntriesFromDistribution(
      distribution,
      FAKE_OWNER_USER_ID,
      partnerReceiverIds,
      { partnerConsentsByRecipientId, amountType },
    );

    const externalReference = buildOpaqueExternalReference(
      "dnx",
      "order",
      "homolog-fixture-001",
    );
    assert.doesNotMatch(externalReference, /@/);

    const items = [
      singleIntangibleItem({
        title: "Inscripcion / servicio intangible",
        total,
        categoryId: "others",
      }),
    ];

    validateMercadoPagoSplitOrder({
      externalReference,
      total,
      amountType,
      entries,
      deviceSessionId: TEST_DEVICE_SESSION_ID,
      payerEmail: "test_buyer@testuser.com",
      statementDescriptor: "DNX",
      items,
      partnerReceiverIds,
      partnerConsentsByRecipientId,
      ownerUserId: FAKE_OWNER_USER_ID,
      allowTestFixtures: true,
    });

    const built = buildMercadoPagoSplitOrderRequest({
      externalReference,
      total,
      amountType,
      entries,
      deviceSessionId: TEST_DEVICE_SESSION_ID,
      payerEmail: "test_buyer@testuser.com",
      statementDescriptor: "DNX",
      items,
      paymentToken: "TEST_CARD_TOKEN_FIXTURE_NOT_A_SECRET",
      paymentMethodId: "visa",
    });

    const snapshot = {
      type: built.body.type,
      external_reference: built.body.external_reference,
      total_amount: built.body.total_amount,
      payer_email: built.body.payer?.email,
      amount_type: built.body.config.split_rules.amount_type,
      splits: built.body.splits.map((s) => ({
        receiver_type: s.receiver_type,
        amount: s.amount,
        // receiver ids truncated — no full dump required
        receiver_id_prefix: s.receiver_id.slice(0, 6),
      })),
      items: built.body.items,
      statement_descriptor:
        built.body.transactions?.payments?.[0]?.payment_method?.statement_descriptor,
      x_meli_session_id: built.headers["x-meli-session-id"],
      max_partners_constant: MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS,
      // idempotency key is transport-level; assert presence contract separately
      has_payment_token_in_body: Boolean(
        built.body.transactions?.payments?.[0]?.payment_method?.token,
      ),
    };

    assert.equal(snapshot.type, "online");
    assert.equal(snapshot.payer_email, "test_buyer@testuser.com");
    assert.equal(snapshot.amount_type, "fixed");
    assert.equal(snapshot.total_amount, "1000.00");
    assert.equal(snapshot.items?.[0]?.quantity, 1);
    assert.equal(snapshot.items?.[0]?.unit_price, "1000.00");
    assert.ok(snapshot.items?.[0]?.title);
    assert.equal(snapshot.statement_descriptor, "DNX");
    assert.equal(snapshot.x_meli_session_id, TEST_DEVICE_SESSION_ID);
    assert.equal(snapshot.splits.length, 3);
    assert.equal(snapshot.splits.filter((s) => s.receiver_type === "owner").length, 1);
    assert.equal(snapshot.splits.filter((s) => s.receiver_type === "partner").length, 2);
    assert.equal(snapshot.max_partners_constant, 10);
    assert.equal(snapshot.has_payment_token_in_body, true);

    const splitSum = snapshot.splits.reduce((acc, s) => acc + Number(s.amount), 0);
    assert.equal(splitSum.toFixed(2), "1000.00");
  });

  it("supports up to 10 partners with exact fixed sum", () => {
    const total = money("ARS", 100_000n);
    const partnerIds = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const rules = [
      {
        recipientId: "owner-share",
        role: "PLATFORM" as const,
        kind: "PERCENTAGE" as const,
        percentageBps: 5000,
        priority: 1,
        optional: false,
      },
      ...partnerIds.map((id, i) => ({
        recipientId: id,
        role: "OTHER" as const,
        kind: "PERCENTAGE" as const,
        percentageBps: 500,
        priority: i + 2,
        optional: false,
      })),
    ];
    const distribution = calculateDistribution({
      total,
      rules,
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["owner-share", ...partnerIds],
    });
    const partnerReceiverIds = new Map(
      partnerIds.map((id, i) => [
        id,
        `a1b2c3d4-e5f6-4789-a012-3456789c${String(i).padStart(4, "0")}`,
      ]),
    );
    const partnerConsentsByRecipientId = new Map(
      [...partnerReceiverIds.entries()].map(([id, rid]) => [
        id,
        testActivePartnerConsent(rid),
      ]),
    );
    const amountType = resolveMpAmountType(distribution, "fixed_preferred");
    const entries = buildSplitEntriesFromDistribution(
      distribution,
      FAKE_OWNER_USER_ID,
      partnerReceiverIds,
      { partnerConsentsByRecipientId, amountType },
    );
    assert.equal(entries.filter((e) => e.receiverType === "partner").length, 10);
    const sum = entries.reduce((acc, e) => acc + (e.amount?.amountMinor ?? 0n), 0n);
    assert.equal(sum, total.amountMinor);
  });
});

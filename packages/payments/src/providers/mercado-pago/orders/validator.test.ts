import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../../money/index.js";
import {
  validateSplitOrderForMercadoPago,
  validateMercadoPagoSplitOrder,
} from "./validator.js";
import { OrderValidationError } from "./errors.js";
import {
  FAKE_OWNER_USER_ID,
  FAKE_PARTNER_RECEIVER_ID,
} from "../testing/fixtures.js";
import { MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS } from "./constants.js";
import { testActivePartnerConsent } from "./consent-evidence.js";
import {
  ConsentExpiredError,
  ConsentRequiredError,
} from "./consent-evidence.js";
import { ConsentNotActiveError } from "../../../errors/provider-errors.js";
import { singleIntangibleItem } from "./order-items.js";
import { TEST_DEVICE_SESSION_ID } from "./test-helpers.js";

describe("validateSplitOrderForMercadoPago", () => {
  const total = money("ARS", 100_000n);

  it("requires deviceSessionId", () => {
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "fixed",
          deviceSessionId: "",
          entries: [],
        }),
      OrderValidationError,
    );
  });

  it("accepts owner-only (0 partners)", () => {
    assert.doesNotThrow(() =>
      validateSplitOrderForMercadoPago({
        total,
        amountType: "fixed",
        deviceSessionId: "device-1",
        entries: [
          { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amount: total },
        ],
      }),
    );
  });

  it("requires UUID partners with ACTIVE consent", () => {
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "fixed",
          deviceSessionId: "device-1",
          entries: [
            { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amount: money("ARS", 50_000n) },
            {
              receiverType: "partner",
              receiverId: "not-a-uuid",
              consentStatus: "ACTIVE",
              amount: money("ARS", 50_000n),
            },
          ],
        }),
      /UUID/,
    );
  });

  it("validates fixed amounts sum to total", () => {
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "fixed",
          deviceSessionId: "device-1",
          entries: [
            { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amount: money("ARS", 60_000n) },
            {
              receiverType: "partner",
              receiverId: FAKE_PARTNER_RECEIVER_ID,
              consentStatus: "ACTIVE",
              amount: money("ARS", 50_000n),
            },
          ],
        }),
      /must equal total/,
    );
  });

  it("accepts valid fixed split", () => {
    assert.doesNotThrow(() =>
      validateSplitOrderForMercadoPago({
        total,
        amountType: "fixed",
        deviceSessionId: "device-1",
        entries: [
          { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amount: money("ARS", 70_000n) },
          {
            receiverType: "partner",
            receiverId: FAKE_PARTNER_RECEIVER_ID,
            consentStatus: "ACTIVE",
            amount: money("ARS", 30_000n),
          },
        ],
      }),
    );
  });

  it("validates percentage sums to 10000 bps", () => {
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "percentage",
          deviceSessionId: "device-1",
          entries: [
            { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amountBps: 5000 },
            {
              receiverType: "partner",
              receiverId: FAKE_PARTNER_RECEIVER_ID,
              consentStatus: "ACTIVE",
              amountBps: 4000,
            },
          ],
        }),
      /10000 bps/,
    );
  });

  it(`enforces max ${MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS} partners`, () => {
    assert.equal(MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS, 10);
    const partnerCount = 11;
    const perPartner = Math.floor(5000 / partnerCount);
    const entries = [
      {
        receiverType: "owner" as const,
        receiverId: FAKE_OWNER_USER_ID,
        amountBps: 10_000 - perPartner * partnerCount,
      },
      ...Array.from({ length: partnerCount }, (_, i) => ({
        receiverType: "partner" as const,
        receiverId: `a1b2c3d4-e5f6-4789-a012-3456789a${String(i).padStart(4, "0")}`,
        consentStatus: "ACTIVE" as const,
        amountBps: perPartner,
      })),
    ];
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "percentage",
          deviceSessionId: "device-1",
          entries,
        }),
      /Maximum 10 partners/,
    );
  });

  it("accepts exactly 10 partners", () => {
    const partnerCount = 10;
    const perPartner = 500;
    const entries = [
      {
        receiverType: "owner" as const,
        receiverId: FAKE_OWNER_USER_ID,
        amountBps: 10_000 - perPartner * partnerCount,
      },
      ...Array.from({ length: partnerCount }, (_, i) => ({
        receiverType: "partner" as const,
        receiverId: `a1b2c3d4-e5f6-4789-a012-3456789b${String(i).padStart(4, "0")}`,
        consentStatus: "ACTIVE" as const,
        amountBps: perPartner,
      })),
    ];
    assert.doesNotThrow(() =>
      validateSplitOrderForMercadoPago({
        total,
        amountType: "percentage",
        deviceSessionId: "device-1",
        entries,
      }),
    );
  });
});

describe("validateMercadoPagoSplitOrder (pre-POST gate)", () => {
  const total = money("ARS", 100_000n);
  const baseEntries = [
    { receiverType: "owner" as const, receiverId: FAKE_OWNER_USER_ID, amount: money("ARS", 70_000n) },
    {
      receiverType: "partner" as const,
      receiverId: FAKE_PARTNER_RECEIVER_ID,
      consentStatus: "ACTIVE" as const,
      amount: money("ARS", 30_000n),
    },
  ];

  function baseInput(overrides: Record<string, unknown> = {}) {
    return {
      externalReference: "dnx-order-homolog-001",
      total,
      amountType: "fixed" as const,
      entries: baseEntries,
      deviceSessionId: TEST_DEVICE_SESSION_ID,
      payerEmail: "test_buyer@testuser.com",
      statementDescriptor: "DNX",
      items: [singleIntangibleItem({ title: "Servicio intangible", total })],
      partnerReceiverIds: new Map([["photographer", FAKE_PARTNER_RECEIVER_ID]]),
      partnerConsentsByRecipientId: new Map([
        ["photographer", testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID)],
      ]),
      ownerUserId: FAKE_OWNER_USER_ID,
      allowTestFixtures: true,
      ...overrides,
    };
  }

  it("accepts a complete homologation payload", () => {
    const result = validateMercadoPagoSplitOrder(baseInput());
    assert.equal(result.payerEmail, "test_buyer@testuser.com");
    assert.equal(result.statementDescriptor, "DNX");
  });

  it("rejects missing payer email", () => {
    assert.throws(() => validateMercadoPagoSplitOrder(baseInput({ payerEmail: "" })), /PAYER_EMAIL/);
  });

  it("rejects malformed payer email", () => {
    assert.throws(
      () => validateMercadoPagoSplitOrder(baseInput({ payerEmail: "not-an-email" })),
      /PAYER_EMAIL_INVALID/,
    );
  });

  it("rejects email in external_reference", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({ externalReference: "buyer@testuser.com" }),
        ),
      /EXTERNAL_REFERENCE_PII/,
    );
  });

  it("rejects missing consent", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({ partnerConsentsByRecipientId: new Map() }),
        ),
      ConsentRequiredError,
    );
  });

  it("rejects PENDING consent", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({
            partnerConsentsByRecipientId: new Map([
              [
                "photographer",
                {
                  receiverId: FAKE_PARTNER_RECEIVER_ID,
                  status: "PENDING",
                  provider: "mercadopago",
                  testFixture: true,
                },
              ],
            ]),
          }),
        ),
      ConsentRequiredError,
    );
  });

  it("rejects REJECTED consent", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({
            partnerConsentsByRecipientId: new Map([
              [
                "photographer",
                {
                  receiverId: FAKE_PARTNER_RECEIVER_ID,
                  status: "REJECTED",
                  provider: "mercadopago",
                  testFixture: true,
                },
              ],
            ]),
          }),
        ),
      ConsentNotActiveError,
    );
  });

  it("rejects CANCELED consent", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({
            partnerConsentsByRecipientId: new Map([
              [
                "photographer",
                {
                  receiverId: FAKE_PARTNER_RECEIVER_ID,
                  status: "CANCELED",
                  provider: "mercadopago",
                  testFixture: true,
                },
              ],
            ]),
          }),
        ),
      ConsentNotActiveError,
    );
  });

  it("rejects EXPIRED consent status", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({
            partnerConsentsByRecipientId: new Map([
              [
                "photographer",
                {
                  receiverId: FAKE_PARTNER_RECEIVER_ID,
                  status: "EXPIRED",
                  provider: "mercadopago",
                  testFixture: true,
                },
              ],
            ]),
          }),
        ),
      ConsentExpiredError,
    );
  });

  it("rejects ACTIVE consent with past expiresAt", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({
            now: new Date("2026-07-31T12:00:00.000Z"),
            partnerConsentsByRecipientId: new Map([
              [
                "photographer",
                testActivePartnerConsent(FAKE_PARTNER_RECEIVER_ID, {
                  expiresAt: "2026-01-01T00:00:00.000Z",
                }),
              ],
            ]),
          }),
        ),
      ConsentExpiredError,
    );
  });

  it("rejects testFixture consent without allowTestFixtures", () => {
    assert.throws(
      () => validateMercadoPagoSplitOrder(baseInput({ allowTestFixtures: false })),
      ConsentNotActiveError,
    );
  });

  it("rejects placeholder device without fixtures", () => {
    assert.throws(
      () =>
        validateMercadoPagoSplitOrder(
          baseInput({
            deviceSessionId: "MISSING_DEVICE",
            allowTestFixtures: false,
            partnerConsentsByRecipientId: new Map([
              [
                "photographer",
                {
                  receiverId: FAKE_PARTNER_RECEIVER_ID,
                  status: "ACTIVE",
                  provider: "mercadopago",
                  // non-fixture productive-shaped evidence
                },
              ],
            ]),
          }),
        ),
      /DEVICE_SESSION_INVALID/,
    );
  });
});

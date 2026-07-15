import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../../money/index.js";
import { validateSplitOrderForMercadoPago } from "./validator.js";
import { OrderValidationError } from "./errors.js";
import {
  FAKE_OWNER_USER_ID,
  FAKE_PARTNER_RECEIVER_ID,
} from "../testing/fixtures.js";

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

  it("requires exactly one owner and at least one partner", () => {
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "fixed",
          deviceSessionId: "device-1",
          entries: [
            { receiverType: "owner", receiverId: FAKE_OWNER_USER_ID, amount: total },
          ],
        }),
      /At least one partner/,
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

  it("enforces max sellers limit", () => {
    const entries = [
      { receiverType: "owner" as const, receiverId: FAKE_OWNER_USER_ID, amountBps: 5000 },
      ...Array.from({ length: 21 }, (_, i) => ({
        receiverType: "partner" as const,
        receiverId: `a1b2c3d4-e5f6-4789-a012-3456789a${String(i).padStart(4, "0")}`,
        consentStatus: "ACTIVE" as const,
        amountBps: Math.floor(5000 / 21),
      })),
    ];
    assert.throws(
      () =>
        validateSplitOrderForMercadoPago({
          total,
          amountType: "percentage",
          deviceSessionId: "device-1",
          entries,
          maxSellers: 20,
        }),
      /Maximum 20 partners/,
    );
  });
});

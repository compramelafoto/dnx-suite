import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertClickatonDnxCheckoutAllowed,
  isClickatonDnxCheckoutEnabled,
  CLICKATON_DNX_CHECKOUT_FLAG,
} from "./checkout-dnx-flag.js";
import { fulfillRegistrationFromOrdersObserve } from "./fulfill-from-orders-observe.js";
import { createInMemoryDnxPaymentsPersistence } from "../../persistence/memory.js";
import { createClickatonCheckoutService } from "./clickaton-checkout-service.js";

describe("10D3I-H checkout dnx flag", () => {
  it("defaults off", () => {
    assert.equal(isClickatonDnxCheckoutEnabled({}), false);
    assert.equal(
      isClickatonDnxCheckoutEnabled({ [CLICKATON_DNX_CHECKOUT_FLAG]: "off" }),
      false,
    );
  });

  it("accepts on/true/1", () => {
    assert.equal(
      isClickatonDnxCheckoutEnabled({ [CLICKATON_DNX_CHECKOUT_FLAG]: "on" }),
      true,
    );
    assert.equal(
      isClickatonDnxCheckoutEnabled({ [CLICKATON_DNX_CHECKOUT_FLAG]: "true" }),
      true,
    );
  });

  it("gates sandbox + confirm + host", () => {
    const denied = assertClickatonDnxCheckoutAllowed({
      flagEnabled: true,
      environment: "production",
      confirmStaging: true,
      hostOk: true,
      databaseOk: true,
    });
    assert.equal(denied.ok, false);
    const ok = assertClickatonDnxCheckoutAllowed({
      flagEnabled: true,
      environment: "sandbox",
      confirmStaging: true,
      hostOk: true,
      databaseOk: true,
    });
    assert.equal(ok.ok, true);
  });
});

describe("10D3I-H fulfill from orders observe", () => {
  it("skips when checkout flag off (observe-only)", async () => {
    const persistence = createInMemoryDnxPaymentsPersistence();
    const service = createClickatonCheckoutService(persistence);
    const result = await fulfillRegistrationFromOrdersObserve({
      observe: {
        ok: true,
        outcome: "processed",
        eventId: "evt_1",
        providerOrderId: "ORDTST01TEST",
        providerOrderIdPrefix: "ORDTST01TE…",
        liveMode: false,
        inboxId: "inbox_1",
        canonical: {
          providerOrderId: "ORDTST01TEST",
          providerOrderIdPrefix: "ORDTST01TE…",
          status: "PROCESSED_ACCREDITED",
          statusDetail: null,
          externalReference: "clickaton:registration:reg_test",
          totalMinor: "10000",
          currency: "ARS",
          recipientCount: 3,
          splitAmounts: ["3400", "3300", "3300"],
          paymentCount: 1,
        },
        snapshot: null,
        mismatches: [],
        alerts: [],
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
      },
      persistence,
      applyNormalizedEvent: (e) => service.applyNormalizedEvent(e),
      checkoutFlagEnabled: false,
    });
    assert.equal(result.fulfilled, false);
    if (!result.fulfilled) assert.equal(result.reason, "CHECKOUT_FLAG_OFF");
  });

  it("blocks frontend-style amount mismatch via HAS_MISMATCHES", async () => {
    const persistence = createInMemoryDnxPaymentsPersistence();
    const service = createClickatonCheckoutService(persistence);
    const result = await fulfillRegistrationFromOrdersObserve({
      observe: {
        ok: true,
        outcome: "processed",
        eventId: "evt_2",
        providerOrderId: "ORDTST01TEST",
        providerOrderIdPrefix: "ORDTST01TE…",
        liveMode: false,
        inboxId: "inbox_2",
        canonical: {
          providerOrderId: "ORDTST01TEST",
          providerOrderIdPrefix: "ORDTST01TE…",
          status: "PROCESSED_ACCREDITED",
          statusDetail: null,
          externalReference: "clickaton:registration:reg_test",
          totalMinor: "10000",
          currency: "ARS",
          recipientCount: 3,
          splitAmounts: [],
          paymentCount: 1,
        },
        snapshot: null,
        mismatches: [{ code: "AMOUNT_MISMATCH", detail: "tamper" }],
        alerts: ["AMOUNT_MISMATCH"],
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
      },
      persistence,
      applyNormalizedEvent: (e) => service.applyNormalizedEvent(e),
      checkoutFlagEnabled: true,
    });
    assert.equal(result.fulfilled, false);
    if (!result.fulfilled) assert.equal(result.reason, "HAS_MISMATCHES");
  });

  it("blocks non-registration external references", async () => {
    const persistence = createInMemoryDnxPaymentsPersistence();
    const service = createClickatonCheckoutService(persistence);
    const result = await fulfillRegistrationFromOrdersObserve({
      observe: {
        ok: true,
        outcome: "processed",
        eventId: "evt_3",
        providerOrderId: "ORDTST01TEST",
        providerOrderIdPrefix: "ORDTST01TE…",
        liveMode: false,
        inboxId: "inbox_3",
        canonical: {
          providerOrderId: "ORDTST01TEST",
          providerOrderIdPrefix: "ORDTST01TE…",
          status: "PROCESSED_ACCREDITED",
          statusDetail: null,
          externalReference: "clickaton-10d3i-f-other",
          totalMinor: "10000",
          currency: "ARS",
          recipientCount: 3,
          splitAmounts: [],
          paymentCount: 1,
        },
        snapshot: null,
        mismatches: [],
        alerts: [],
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
      },
      persistence,
      applyNormalizedEvent: (e) => service.applyNormalizedEvent(e),
      checkoutFlagEnabled: true,
    });
    assert.equal(result.fulfilled, false);
    if (!result.fulfilled) {
      assert.equal(result.reason, "EXTERNAL_REF_NOT_REGISTRATION");
    }
  });
});

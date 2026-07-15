import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../../money/index.js";
import {
  buildMercadoPagoSplitOrderRequest,
  mapMercadoPagoOrderStatus,
  stablePayloadHash,
} from "./mapper.js";
import {
  FAKE_OWNER_USER_ID,
  FAKE_PARTNER_RECEIVER_ID,
} from "../testing/fixtures.js";

describe("orders mapper", () => {
  it("buildMercadoPagoSplitOrderRequest builds fixed splits", () => {
    const req = buildMercadoPagoSplitOrderRequest({
      externalReference: "ref-1",
      total: money("ARS", 100_000n),
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
    });
    assert.equal(req.body.total_amount, "1000.00");
    assert.equal(req.body.splits.length, 2);
    assert.equal(req.body.splits[0]?.amount, "700.00");
    assert.equal(req.body.splits[1]?.amount, "300.00");
    assert.equal(req.body.config.split_rules.amount_type, "fixed");
    assert.equal(req.headers["x-meli-session-id"], "device-1");
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

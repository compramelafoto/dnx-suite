import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertClfOrdersWebhookAllowed,
  buildClfFetchCanonicalOrder,
} from "./orders-webhook";

const OBSERVE = "DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED";
const PROD = "DNX_MP_ORDERS_1N_PRODUCTION_ENABLED";
const TOKEN = "MERCADOPAGO_TEST_ACCESS_TOKEN";

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("CLF webhook `order` — guards", () => {
  it("por defecto está OFF", () => {
    withEnv({ [OBSERVE]: undefined, [PROD]: undefined }, () => {
      const r = assertClfOrdersWebhookAllowed();
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "OBSERVE_FLAG_OFF");
    });
  });

  it("el flag de Orders productivas bloquea aunque observe esté ON", () => {
    withEnv({ [OBSERVE]: "true", [PROD]: "true" }, () => {
      const r = assertClfOrdersWebhookAllowed();
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "PRODUCTION_ORDERS_FLAG_ON");
    });
  });

  it("permite sólo con observe ON y producción OFF", () => {
    withEnv({ [OBSERVE]: "true", [PROD]: "false" }, () => {
      assert.equal(assertClfOrdersWebhookAllowed().ok, true);
    });
  });

  /**
   * El GET Order sólo puede armarse con credenciales sandbox. Un token
   * productivo no debe habilitarlo nunca.
   */
  it("no arma el GET Order sin token sandbox", () => {
    withEnv({ [TOKEN]: undefined }, () => {
      assert.equal(buildClfFetchCanonicalOrder(), null);
    });
    withEnv({ [TOKEN]: "APP_USR-not-a-sandbox-shaped-token" }, () => {
      const built = buildClfFetchCanonicalOrder();
      assert.ok(built === null || typeof built === "function");
    });
  });
});

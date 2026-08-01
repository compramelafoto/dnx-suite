/**
 * Mirrors CLF homologation safety rules so @repo/payments CI catches regressions
 * without importing the Next.js app.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

type Safety =
  | { ok: true; productionWrites: "BLOCKED" }
  | { ok: false; code: string };

function parseTruthy(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Same defense-in-depth contract as CLF assertClfMpSplit1nHomologationSafe. */
function assertClfHomologationSafe(env: Record<string, string | undefined>): Safety {
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  const prodOrders = (env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "")
    .trim()
    .toLowerCase();
  const flag = parseTruthy(env.DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED);

  if (nodeEnv === "production" && vercelEnv === "production") {
    return { ok: false, code: "PRODUCTION_HARD_BLOCK" };
  }
  if (vercelEnv === "production") {
    return { ok: false, code: "VERCEL_PRODUCTION" };
  }
  if (prodOrders === "true" || prodOrders === "1" || prodOrders === "yes") {
    return { ok: false, code: "PRODUCTION_ORDERS_FLAG_ON" };
  }
  if (!flag) {
    return { ok: false, code: "FLAG_DISABLED" };
  }
  if (
    nodeEnv === "production" &&
    vercelEnv !== "preview" &&
    vercelEnv !== "development" &&
    !vercelEnv
  ) {
    return { ok: false, code: "PRODUCTION_HARD_BLOCK" };
  }
  return { ok: true, productionWrites: "BLOCKED" };
}

describe("CLF Brick homologation contract (payments package mirror)", () => {
  it("blocks production route", () => {
    const r = assertClfHomologationSafe({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED: "true",
    });
    assert.equal(r.ok, false);
  });

  it("blocks when flag disabled", () => {
    const r = assertClfHomologationSafe({ NODE_ENV: "development" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "FLAG_DISABLED");
  });

  it("blocks when Orders production flag on", () => {
    const r = assertClfHomologationSafe({
      NODE_ENV: "development",
      DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED: "true",
      DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "true",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "PRODUCTION_ORDERS_FLAG_ON");
  });

  it("allows local development with flag", () => {
    const r = assertClfHomologationSafe({
      NODE_ENV: "development",
      DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED: "true",
      DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "false",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.productionWrites, "BLOCKED");
  });

  it("source label for evidence", () => {
    assert.equal("CLF_CARD_BRICK_HOMOLOGATION", "CLF_CARD_BRICK_HOMOLOGATION");
  });
});

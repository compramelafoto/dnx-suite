import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateResendWebhookReadiness } from "./readiness";

const baseEnv = {
  COMMUNICATIONS_RESEND_WEBHOOK_ENABLED: "true",
  COMMUNICATIONS_WEBHOOK_MODE: "verify_only",
  COMMUNICATIONS_WEBHOOK_ENVIRONMENT: "staging",
  RESEND_WEBHOOK_SECRET: "whsec_test_not_real",
  COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS:
    "email.sent,email.delivered,email.delivery_delayed,email.bounced,email.complained,email.failed,email.suppressed",
  DATABASE_URL: "postgresql://u:p@ep-round-fog-x.aws.neon.tech/clickaton_staging",
};

test("readiness READY WITH WARNINGS en phase C con ping ok", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: baseEnv,
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.phase, "C_verify_only");
  assert.notEqual(report.status, "NOT READY");
});

test("readiness NOT READY sin secret", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: { ...baseEnv, RESEND_WEBHOOK_SECRET: "" },
    pingDatabase: async () => ({ ok: true, tableReady: true, uniqueReady: true }),
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.checks.secretPresent?.ok, false);
});

test("readiness NOT READY con process", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: { ...baseEnv, COMMUNICATIONS_WEBHOOK_MODE: "process" },
    pingDatabase: async () => ({ ok: true, tableReady: true, uniqueReady: true }),
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.phase, "D_process");
});

test("readiness NOT READY con DB producción", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      DATABASE_URL: "postgresql://u:p@db.maratonfotografica.com/prod",
    },
  });
  assert.equal(report.checks.databaseIdentity?.ok, false);
  assert.equal(report.status, "NOT READY");
});

test("readiness fase A prepared", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_RESEND_WEBHOOK_ENABLED: "false",
      COMMUNICATIONS_WEBHOOK_MODE: "disabled",
    },
  });
  assert.equal(report.phase, "A_prepared");
});

test("readiness bloquea opened en allowlist", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS: "email.delivered,email.opened",
    },
    pingDatabase: async () => ({ ok: true, tableReady: true, uniqueReady: true }),
  });
  assert.equal(report.checks.allowedEvents?.ok, false);
});

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
  COMMUNICATIONS_EXPECTED_DATABASE_ENV: "staging",
  COMMUNICATIONS_EXPECTED_HOST_PREFIX: "ep-round-fog",
  COMMUNICATIONS_EXPECTED_DATABASE_NAME: "neondb",
};

const stagingUrl =
  "postgresql://u:p@ep-round-fog-x.aws.neon.tech/neondb";
const denylistUrl =
  "postgresql://u:p@ep-dawn-dew-x.aws.neon.tech/neondb";

test("staging_explicit sin URL → NOT READY", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: { ...baseEnv, DATABASE_URL: denylistUrl },
    dbMode: "staging_explicit",
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.checks.explicitStagingUrl?.ok, false);
  assert.equal(report.checks.databaseIdentity?.ok, false);
});

test("staging_explicit no usa DATABASE_URL denylist como fallback", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      DATABASE_URL: denylistUrl,
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.notEqual(report.status, "NOT READY");
  assert.equal(report.checks.databaseIdentity?.ok, true);
  assert.equal(report.checks.noDatabaseUrlFallback?.ok, true);
  assert.equal(report.checks.schemaTable?.ok, true);
});

test("staging_explicit URL denylist → NOT READY", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_STAGING_DATABASE_URL: denylistUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.checks.databaseIdentity?.ok, false);
});

test("staging_explicit schema faltante → NOT READY", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: false,
      uniqueReady: false,
    }),
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.checks.schemaTable?.ok, false);
});

test("staging_explicit schema listo + verify_only → READY/WARNINGS", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.notEqual(report.status, "NOT READY");
  assert.equal(report.phase, "C_verify_only");
  assert.equal(report.checks.schemaTable?.ok, true);
  assert.equal(report.checks.uniqueConstraint?.ok, true);
});

test("local mode nunca READY para go-live aunque ping ok", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      DATABASE_URL: "postgresql://u:p@localhost:5432/neondb",
    },
    dbMode: "local",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.status, "NOT READY");
  assert.ok(
    report.warnings.some((w) => w.includes("local_db_mode") || w.includes("local")),
  );
});

test("readiness NOT READY sin secret en verify_only", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      RESEND_WEBHOOK_SECRET: "",
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.checks.secretPresent?.ok, false);
});

test("readiness NOT READY con process", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_WEBHOOK_MODE: "process",
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.status, "NOT READY");
  assert.equal(report.phase, "D_process");
});

test("fase B sin secret advierte READY FOR RESEND WEBHOOK SECRET", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_WEBHOOK_MODE: "disabled",
      RESEND_WEBHOOK_SECRET: "",
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.phase, "B_exposed_disabled");
  assert.ok(
    report.warnings.some((w) => w.includes("READY FOR RESEND WEBHOOK SECRET")),
  );
});

test("bloquea opened en allowlist", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS: "email.delivered,email.opened",
      COMMUNICATIONS_STAGING_DATABASE_URL: stagingUrl,
    },
    dbMode: "staging_explicit",
    pingDatabase: async () => ({
      ok: true,
      tableReady: true,
      uniqueReady: true,
    }),
  });
  assert.equal(report.checks.allowedEvents?.ok, false);
});

test("database name distinta de neondb → NOT READY", async () => {
  const report = await evaluateResendWebhookReadiness({
    env: {
      ...baseEnv,
      COMMUNICATIONS_STAGING_DATABASE_URL:
        "postgresql://u:p@ep-round-fog-x.aws.neon.tech/clickaton_staging",
    },
    dbMode: "staging_explicit",
  });
  assert.equal(report.status, "NOT READY");
  assert.match(
    report.checks.databaseIdentity?.detail ?? "",
    /database_mismatch/,
  );
});

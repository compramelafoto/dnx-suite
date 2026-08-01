import assert from "node:assert/strict";
import { test } from "node:test";
import {
  admitTrackingEvent,
  createStagingWebhookEnvironmentPolicy,
  parseAllowedTrackingEvents,
  STAGING_TECHNICAL_TRACKING_EVENTS,
} from "./environment-policy";
import {
  createNoopWebhookAlertSink,
  createTestWebhookAlertSink,
  createThresholdAlertTracker,
} from "./alerts";
import {
  createInMemoryWebhookRateLimiter,
  createNoopWebhookRateLimiter,
} from "./rate-limit";
import {
  createFakeWebhookSignatureVerifier,
  createInMemoryWebhookReceiptRepository,
} from "./index";
import { createResendWebhookProcessor } from "./resend/processor";
import {
  fixtureHeaders,
  loadResendWebhookFixture,
} from "./resend/__fixtures__/index";
import { createStagingWebhookEnvironmentPolicy as stagingPolicy } from "./environment-policy";

test("allowlist staging técnica por defecto", () => {
  const parsed = parseAllowedTrackingEvents(undefined);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.events.length, STAGING_TECHNICAL_TRACKING_EVENTS.length);
  assert.equal(parsed.events.includes("email.opened"), false);
});

test("allowlist vacía / inválida / duplicados", () => {
  assert.equal(parseAllowedTrackingEvents("").ok, true); // fallback default
  assert.equal(parseAllowedTrackingEvents("email.not_real").ok, false);
  const dup = parseAllowedTrackingEvents(
    "email.delivered,email.delivered,email.bounced",
  );
  assert.equal(dup.ok, true);
  if (dup.ok) assert.equal(dup.events.length, 2);
});

test("admit: técnicos ok; opened/clicked bloqueados", () => {
  const policy = createStagingWebhookEnvironmentPolicy();
  assert.equal(
    admitTrackingEvent({ policy, eventType: "email.delivered" }).admit,
    true,
  );
  const opened = admitTrackingEvent({ policy, eventType: "email.opened" });
  assert.equal(opened.admit, false);
  if (!opened.admit) {
    assert.equal(opened.errorCode, "WEBHOOK_EVENT_NOT_ALLOWED_IN_ENVIRONMENT");
  }
  const clicked = admitTrackingEvent({ policy, eventType: "email.clicked" });
  assert.equal(clicked.admit, false);
});

test("processor: opened/clicked ignored sin persistir", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const policy = stagingPolicy();
  const processor = createResendWebhookProcessor({
    verifier: createFakeWebhookSignatureVerifier({ valid: true }),
    receiptRepository: repo,
    environmentPolicy: policy,
    mode: "verify_only",
  });

  for (const name of ["email.opened", "email.clicked"] as const) {
    const result = await processor.process({
      rawBody: loadResendWebhookFixture(name),
      headers: fixtureHeaders(`evt_block_${name}`),
    });
    assert.equal(result.status, "ignored");
    assert.equal(result.errorCode, "WEBHOOK_EVENT_NOT_ALLOWED_IN_ENVIRONMENT");
    assert.equal(
      await repo.findByProviderEventId({
        provider: "resend",
        providerEventId: `evt_block_${name}`,
      }),
      null,
    );
  }
});

test("processor: delivered permitido y persistido", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const processor = createResendWebhookProcessor({
    verifier: createFakeWebhookSignatureVerifier({ valid: true }),
    receiptRepository: repo,
    environmentPolicy: stagingPolicy(),
    mode: "verify_only",
  });
  const result = await processor.process({
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders("evt_tech_ok"),
  });
  assert.equal(result.status, "processed");
  assert.equal(
    (await repo.findByProviderEventId({
      provider: "resend",
      providerEventId: "evt_tech_ok",
    }))?.status,
    "verified",
  );
});

test("rate limit noop vs memory", async () => {
  const noop = createNoopWebhookRateLimiter();
  const a = await noop.consume({ key: "x" });
  assert.equal(a.allowed, true);
  assert.equal(a.backend, "noop");

  const mem = createInMemoryWebhookRateLimiter({
    enabled: true,
    requests: 2,
    windowSeconds: 60,
  });
  assert.equal((await mem.consume({ key: "k" })).allowed, true);
  assert.equal((await mem.consume({ key: "k" })).allowed, true);
  assert.equal((await mem.consume({ key: "k" })).allowed, false);
});

test("alert sink test + fallo no rompe", async () => {
  const sink = createTestWebhookAlertSink();
  const tracker = createThresholdAlertTracker({
    config: {
      enabled: true,
      signatureFailureThreshold: 2,
      databaseFailureThreshold: 1,
      windowSeconds: 300,
    },
    sink,
    environment: "staging",
  });
  await tracker.onSignatureFailure("r1");
  assert.equal(sink.alerts.length, 0);
  await tracker.onSignatureFailure("r2");
  assert.equal(sink.alerts.length, 1);

  sink.failNext = true;
  const tracker2 = createThresholdAlertTracker({
    config: {
      enabled: true,
      signatureFailureThreshold: 1,
      databaseFailureThreshold: 1,
      windowSeconds: 300,
    },
    sink,
    environment: "staging",
  });
  const emitted = await tracker2.onDatabaseFailure("r3");
  assert.equal(emitted.emitted, false);

  const noop = createNoopWebhookAlertSink();
  await noop.notify({
    type: "database_failure",
    environment: "staging",
    provider: "resend",
    count: 1,
    windowSeconds: 300,
    occurredAt: new Date(),
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createFakeWebhookSignatureVerifier,
  createInMemoryTrackingEventHandler,
} from "../index";
import { createResendWebhookProcessor } from "../resend/processor";
import {
  fixtureHeaders,
  loadResendWebhookFixture,
} from "../resend/__fixtures__/index";
import { createHmacRecipientHasher } from "./hmac";
import { createInMemoryWebhookReceiptRepository } from "./in-memory-receipt-repository";

test("reserva atómica: evento nuevo → reserved; segundo → duplicate", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const first = await repo.reserve({
    provider: "resend",
    providerEventId: "evt_1",
    rawEventType: "email.delivered",
    normalizedEventType: "email.delivered",
    receivedAt: new Date("2026-01-15T12:00:00.000Z"),
  });
  assert.equal(first.kind, "reserved");
  await repo.markProcessed({ id: first.record.id, status: "verified" });

  const second = await repo.reserve({
    provider: "resend",
    providerEventId: "evt_1",
    rawEventType: "email.delivered",
    receivedAt: new Date(),
  });
  assert.equal(second.kind, "duplicate");
  assert.equal(second.record.status, "verified");
});

test("failed permite retry", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const reserved = await repo.reserve({
    provider: "resend",
    providerEventId: "evt_fail",
    rawEventType: "email.delivered",
    receivedAt: new Date(),
  });
  assert.equal(reserved.kind, "reserved");
  await repo.markFailed({
    id: reserved.record.id,
    errorCode: "WEBHOOK_HANDLER_FAILED",
  });
  const retry = await repo.reserve({
    provider: "resend",
    providerEventId: "evt_fail",
    rawEventType: "email.delivered",
    receivedAt: new Date(),
  });
  assert.equal(retry.kind, "retry");
  assert.equal(retry.record.processingAttempts >= 2, true);
});

test("processor verify_only persiste y deduplica con receipt repo", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const handler = createInMemoryTrackingEventHandler();
  const processor = createResendWebhookProcessor({
    verifier: createFakeWebhookSignatureVerifier({ valid: true }),
    handler,
    receiptRepository: repo,
    mode: "verify_only",
  });
  const input = {
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders("evt_persist_1"),
  };
  const first = await processor.process(input);
  const second = await processor.process(input);
  assert.equal(first.status, "processed");
  assert.equal(second.status, "duplicate");
  assert.equal(handler.events.length, 0);
  assert.equal(repo.size(), 1);
  const stored = await repo.findByProviderEventId({
    provider: "resend",
    providerEventId: "evt_persist_1",
  });
  assert.equal(stored?.status, "verified");
  assert.equal(stored?.productEffectsEnabled, false);
  assert.equal(stored?.recipientMasked?.includes("@"), true);
  assert.equal(Boolean(stored?.recipientMasked?.includes("*")), true);
});

test("fallo temporal de DB → failed (retry HTTP)", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  repo.failReserveOnce();
  const processor = createResendWebhookProcessor({
    verifier: createFakeWebhookSignatureVerifier({ valid: true }),
    receiptRepository: repo,
    mode: "verify_only",
  });
  const result = await processor.process({
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders("evt_db_fail"),
  });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "WEBHOOK_HANDLER_FAILED");
});

test("evento unknown se persiste como ignored", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const processor = createResendWebhookProcessor({
    verifier: createFakeWebhookSignatureVerifier({ valid: true }),
    receiptRepository: repo,
    mode: "verify_only",
  });
  const result = await processor.process({
    rawBody: loadResendWebhookFixture("email.unknown"),
    headers: fixtureHeaders("evt_unknown_persist"),
  });
  assert.equal(result.status, "ignored");
  const stored = await repo.findByProviderEventId({
    provider: "resend",
    providerEventId: "evt_unknown_persist",
  });
  assert.equal(stored?.status, "ignored");
  assert.equal(stored?.rawEventType, "domain.created");
});

test("HMAC recipient hasher no es reversible ni usa SHA simple", () => {
  const hasher = createHmacRecipientHasher("test_secret_not_real");
  const a = hasher.hash("user@example.com");
  const b = hasher.hash("User@Example.com");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(a, "user@example.com");
});

test("registro no incluye PII prohibida", async () => {
  const repo = createInMemoryWebhookReceiptRepository();
  const processor = createResendWebhookProcessor({
    verifier: createFakeWebhookSignatureVerifier({ valid: true }),
    receiptRepository: repo,
    mode: "verify_only",
  });
  await processor.process({
    rawBody: loadResendWebhookFixture("email.clicked"),
    headers: fixtureHeaders("evt_privacy"),
  });
  const stored = await repo.findByProviderEventId({
    provider: "resend",
    providerEventId: "evt_privacy",
  });
  const json = JSON.stringify(stored);
  assert.equal(json.includes("clicker@example.com"), false);
  assert.equal(json.includes("token=SHOULD_STRIP"), false);
  assert.equal(json.includes("svix-signature"), false);
  assert.equal(stored?.safeLinkHost, "example.com");
});

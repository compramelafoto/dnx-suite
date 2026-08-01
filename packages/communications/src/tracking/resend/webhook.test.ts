import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMMUNICATION_TRACKING_EVENT_TYPES,
  createFakeWebhookSignatureVerifier,
  createInMemoryTrackingEventDeduplicator,
  createInMemoryTrackingEventHandler,
  isCommunicationTrackingEventType,
  maskProviderId,
  sanitizeTrackingMetadata,
  toMaskedRecipient,
} from "../index";
import { normalizeClickedUrl } from "./click-url";
import { loadResendWebhookConfig } from "./config";
import {
  fixtureHeaders,
  loadResendWebhookFixture,
} from "./__fixtures__/index";
import { normalizeResendWebhookEvent, RESEND_TO_DNX_EVENT_MAP } from "./normalize";
import { parseResendWebhookPayload } from "./parser";
import { createResendWebhookProcessor } from "./processor";
import { createResendSdkWebhookSignatureVerifier } from "./verifier";
import * as root from "../../index";

const RECEIVED_AT = new Date("2026-01-15T13:00:00.000Z");

function processor(options: {
  mode?: "disabled" | "verify_only" | "process";
  validSignature?: boolean;
  failHandler?: boolean;
  allowHttpLinks?: boolean;
}) {
  const handler = createInMemoryTrackingEventHandler(
    options.failHandler ? { failWith: "handler boom" } : {},
  );
  const deduplicator = createInMemoryTrackingEventDeduplicator();
  const verifier = createFakeWebhookSignatureVerifier({
    valid: options.validSignature !== false,
  });
  const proc = createResendWebhookProcessor({
    verifier,
    handler,
    deduplicator,
    mode: options.mode ?? "process",
    allowHttpLinks: options.allowHttpLinks,
  });
  return { proc, handler, deduplicator, verifier };
}

test("catálogo interno de tracking tipado", () => {
  assert.equal(COMMUNICATION_TRACKING_EVENT_TYPES.length, 9);
  assert.equal(isCommunicationTrackingEventType("email.delivered"), true);
  assert.equal(isCommunicationTrackingEventType("email.scheduled"), false);
});

test("mapping Resend → DNX 1:1 para email.* soportados", () => {
  for (const [external, internal] of Object.entries(RESEND_TO_DNX_EVENT_MAP)) {
    assert.equal(external, internal);
  }
});

test("modo disabled rechaza sin handler", async () => {
  const { proc, handler } = processor({ mode: "disabled" });
  const result = await proc.process({
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders(),
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.errorCode, "WEBHOOK_DISABLED");
  assert.equal(handler.events.length, 0);
});

test("configuración faltante para modo process", () => {
  const loaded = loadResendWebhookConfig({
    COMMUNICATIONS_RESEND_WEBHOOK_ENABLED: "true",
    COMMUNICATIONS_WEBHOOK_MODE: "process",
    RESEND_WEBHOOK_SECRET: "",
  });
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.equal(loaded.errorCode, "WEBHOOK_CONFIGURATION_MISSING");
  }
});

test("payload vacío / demasiado grande / JSON inválido / esquema inválido", async () => {
  const { proc } = processor({ mode: "process" });

  const empty = await proc.process({ rawBody: "   ", headers: fixtureHeaders() });
  assert.equal(empty.errorCode, "WEBHOOK_PAYLOAD_EMPTY");

  const huge = await proc.process({
    rawBody: `{${"x".repeat(70_000)}}`,
    headers: fixtureHeaders(),
  });
  assert.equal(huge.errorCode, "WEBHOOK_PAYLOAD_TOO_LARGE");

  const badJson = await proc.process({
    rawBody: "{not-json",
    headers: fixtureHeaders(),
  });
  assert.equal(badJson.errorCode, "WEBHOOK_JSON_INVALID");

  const badSchema = await proc.process({
    rawBody: JSON.stringify({ type: 1 }),
    headers: fixtureHeaders(),
  });
  assert.equal(badSchema.errorCode, "WEBHOOK_SCHEMA_INVALID");

  const arrayPayload = parseResendWebhookPayload("[]");
  assert.equal(arrayPayload.ok, false);
  if (!arrayPayload.ok) {
    assert.equal(arrayPayload.errorCode, "WEBHOOK_SCHEMA_INVALID");
  }
});

test("firma ausente e inválida nunca ejecutan handler", async () => {
  const { proc, handler } = processor({ mode: "process", validSignature: false });

  const missing = await proc.process({
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: {},
  });
  assert.equal(missing.status, "rejected");
  assert.equal(missing.errorCode, "WEBHOOK_SIGNATURE_MISSING");
  assert.equal(handler.events.length, 0);

  const invalid = await proc.process({
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders(),
  });
  assert.equal(invalid.status, "rejected");
  assert.equal(invalid.errorCode, "WEBHOOK_SIGNATURE_INVALID");
  assert.equal(handler.events.length, 0);
});

test("firma válida procesa delivered", async () => {
  const { proc, handler } = processor({ mode: "process" });
  const result = await proc.process({
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders("evt_delivered_1"),
    receivedAt: RECEIVED_AT,
  });
  assert.equal(result.status, "processed");
  assert.equal(result.ok, true);
  assert.equal(result.eventType, "email.delivered");
  assert.equal(result.providerEventId, "evt_delivered_1");
  assert.equal(result.providerMessageId, "msg_fixture_delivered_001");
  assert.equal(handler.events.length, 1);
  assert.equal(handler.events[0]?.recipient?.maskedEmail?.includes("*"), true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(handler.events[0] ?? {}, "rawBody"),
    false,
  );
});

test("eventos bounced / complained / opened / clicked / failed / suppressed", async () => {
  const cases = [
    "email.bounced",
    "email.complained",
    "email.opened",
    "email.clicked",
    "email.failed",
    "email.suppressed",
  ] as const;

  for (const name of cases) {
    const { proc, handler } = processor({ mode: "process" });
    const result = await proc.process({
      rawBody: loadResendWebhookFixture(name),
      headers: fixtureHeaders(`evt_${name}`),
      receivedAt: RECEIVED_AT,
    });
    assert.equal(result.status, "processed", name);
    assert.equal(result.eventType, name, name);
    assert.equal(handler.events.length, 1, name);

    if (name === "email.bounced") {
      assert.equal(handler.events[0]?.reason?.bounceType, "hard");
    }
    if (name === "email.clicked") {
      assert.equal(handler.events[0]?.link?.discardedUnsafe, false);
      assert.equal(handler.events[0]?.link?.hostname, "example.com");
      assert.equal(handler.events[0]?.link?.safeUrl?.includes("token="), false);
    }
  }
});

test("evento desconocido se ignora", async () => {
  const { proc, handler } = processor({ mode: "process" });
  const result = await proc.process({
    rawBody: loadResendWebhookFixture("email.unknown"),
    headers: fixtureHeaders("evt_unknown"),
  });
  assert.equal(result.status, "ignored");
  assert.equal(result.errorCode, "WEBHOOK_EVENT_UNSUPPORTED");
  assert.equal(handler.events.length, 0);
});

test("timestamp inválido falla normalización", async () => {
  const { proc, handler } = processor({ mode: "process" });
  const result = await proc.process({
    rawBody: JSON.stringify({
      type: "email.delivered",
      created_at: "not-a-date",
      data: { email_id: "msg_x" },
    }),
    headers: fixtureHeaders("evt_bad_ts"),
  });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "WEBHOOK_TIMESTAMP_INVALID");
  assert.equal(handler.events.length, 0);
});

test("URL segura e insegura en clicked", () => {
  const safe = normalizeClickedUrl("https://example.com/path?utm=1&token=x");
  assert.equal(safe.discardedUnsafe, false);
  assert.equal(safe.hostname, "example.com");
  assert.equal(safe.safeUrl?.includes("token="), false);

  const js = normalizeClickedUrl("javascript:alert(1)");
  assert.equal(js.discardedUnsafe, true);

  const data = normalizeClickedUrl("data:text/html,hi");
  assert.equal(data.discardedUnsafe, true);

  const httpDenied = normalizeClickedUrl("http://example.com");
  assert.equal(httpDenied.discardedUnsafe, true);

  const httpAllowed = normalizeClickedUrl("http://example.com", {
    allowHttp: true,
  });
  assert.equal(httpAllowed.discardedUnsafe, false);
});

test("enmascarado de destinatario y provider id", () => {
  const recipient = toMaskedRecipient("User@Example.com");
  assert.ok(recipient);
  assert.notEqual(recipient.maskedEmail, "User@Example.com");
  assert.equal(recipient.maskedEmail.includes("@"), true);
  assert.equal(recipient.emailHash.length, 32);

  const masked = maskProviderId("msg_fixture_delivered_001");
  assert.ok(masked);
  assert.notEqual(masked, "msg_fixture_delivered_001");
});

test("deduplicación no reejecuta handler", async () => {
  const { proc, handler, deduplicator } = processor({ mode: "process" });
  const input = {
    rawBody: loadResendWebhookFixture("email.sent"),
    headers: fixtureHeaders("evt_dedupe_1"),
    receivedAt: RECEIVED_AT,
  };
  const first = await proc.process(input);
  const second = await proc.process(input);
  assert.equal(first.status, "processed");
  assert.equal(second.status, "duplicate");
  assert.equal(handler.events.length, 1);
  assert.equal(deduplicator.size(), 1);
});

test("handler fallido no marca dedupe", async () => {
  const { proc, handler, deduplicator } = processor({
    mode: "process",
    failHandler: true,
  });
  const input = {
    rawBody: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders("evt_fail_handler"),
  };
  const result = await proc.process(input);
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "WEBHOOK_HANDLER_FAILED");
  assert.equal(handler.events.length, 0);
  assert.equal(await deduplicator.has("evt_fail_handler"), false);
});

test("verify_only no ejecuta handler", async () => {
  const { proc, handler } = processor({ mode: "verify_only" });
  const result = await proc.process({
    rawBody: loadResendWebhookFixture("email.opened"),
    headers: fixtureHeaders("evt_verify_only"),
  });
  assert.equal(result.status, "processed");
  assert.equal(result.eventType, "email.opened");
  assert.equal(handler.events.length, 0);
});

test("logger metadata sanitizada no conserva secretos", () => {
  const sanitized = sanitizeTrackingMetadata({
    api_key: "secret",
    signature: "sig",
    html: "<b>x</b>",
    safeFlag: true,
  });
  assert.equal(sanitized?.api_key, undefined);
  assert.equal(sanitized?.signature, undefined);
  assert.equal(sanitized?.html, undefined);
  assert.equal(sanitized?.safeFlag, true);
});

test("normalizer conserva provider ids y rawEventType", () => {
  const parsed = parseResendWebhookPayload(
    loadResendWebhookFixture("email.delivered"),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const normalized = normalizeResendWebhookEvent({
    envelope: parsed.envelope,
    providerEventId: "svix_abc",
    receivedAt: RECEIVED_AT,
  });
  assert.equal(normalized.ok, true);
  if (!normalized.ok || !normalized.supported) return;
  assert.equal(normalized.event.providerEventId, "svix_abc");
  assert.equal(normalized.event.providerMessageId, "msg_fixture_delivered_001");
  assert.equal(normalized.event.rawEventType, "email.delivered");
  assert.equal(normalized.event.channel, "email");
  assert.equal(normalized.event.provider, "resend");
});

test("verifier SDK real exige secreto y headers; API inyectable", async () => {
  let called = false;
  const verifier = createResendSdkWebhookSignatureVerifier({
    secret: "whsec_test_not_real",
    verifyApi: {
      verify() {
        called = true;
        return { type: "email.delivered" };
      },
    },
  });

  const missingSecret = createResendSdkWebhookSignatureVerifier({
    secret: "   ",
  });
  const cfg = await missingSecret.verify({
    payload: "{}",
    headers: fixtureHeaders(),
  });
  assert.equal(cfg.ok, false);
  if (!cfg.ok) assert.equal(cfg.code, "WEBHOOK_CONFIGURATION_MISSING");

  const ok = await verifier.verify({
    payload: loadResendWebhookFixture("email.delivered"),
    headers: fixtureHeaders(),
  });
  assert.equal(ok.ok, true);
  assert.equal(called, true);

  const bad = createResendSdkWebhookSignatureVerifier({
    secret: "whsec_test_not_real",
    verifyApi: {
      verify() {
        throw new Error("Invalid signature");
      },
    },
  });
  const rejected = await bad.verify({
    payload: "{}",
    headers: fixtureHeaders(),
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, "WEBHOOK_SIGNATURE_INVALID");
});

test("entrypoint raíz no exporta SDK / processor / verifier real", () => {
  assert.equal(
    Object.prototype.hasOwnProperty.call(root, "createResendWebhookProcessor"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      root,
      "createResendSdkWebhookSignatureVerifier",
    ),
    false,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(root, "Resend"), false);
  assert.equal(typeof root.createFakeWebhookSignatureVerifier, "function");
  assert.equal(typeof root.COMMUNICATION_TRACKING_EVENT_TYPES, "object");
});

test("import smoke: sin side effects de red al cargar tracking/resend", async () => {
  const mod = await import("./index");
  assert.equal(typeof mod.createResendWebhookProcessor, "function");
  assert.equal(typeof mod.createResendSdkWebhookSignatureVerifier, "function");
  assert.equal(typeof mod.parseResendWebhookPayload, "function");
});

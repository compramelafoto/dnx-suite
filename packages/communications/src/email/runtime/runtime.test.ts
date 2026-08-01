import assert from "node:assert/strict";
import { test } from "node:test";
import { CommunicationError } from "../../shared/errors";
import { createCommunicationsFacade } from "../../communications";
import { createResendSdkClientAdapter } from "../providers/resend-sdk-adapter";
import {
  assertRecipientsAllowed,
  createResendEmailRuntime,
  createSmokeIdempotencyKey,
  evaluateLiveSendGates,
  isRecipientAllowed,
  loadResendEmailConfig,
  maskEmail,
  maskIdempotencyKey,
  normalizeEmailAddress,
  parseAllowedRecipients,
  parseControlledFromAddress,
} from "./index";

const baseEnv = {
  RESEND_API_KEY: "re_test_fake_key",
  RESEND_FROM_EMAIL: "noreply@example.com",
  RESEND_FROM_NAME: "DNX Test",
  RESEND_ALLOWED_RECIPIENTS: "alpha@example.com, beta@example.com",
  COMMUNICATIONS_LIVE_SEND: "false",
  COMMUNICATIONS_ENVIRONMENT: "development",
};

test("maskEmail enmascara local-part", () => {
  assert.equal(maskEmail("daniel@example.com"), "da***@example.com");
  assert.equal(maskEmail("a@example.com"), "a***@example.com");
  assert.equal(maskEmail("not-an-email"), "***");
});

test("allowlist: parse / normalize / invalid / wildcards", () => {
  const list = parseAllowedRecipients(" Alpha@Example.com , beta@example.com ");
  assert.deepEqual(list, ["alpha@example.com", "beta@example.com"]);
  assert.equal(isRecipientAllowed(list, "ALPHA@example.com"), true);
  assert.equal(normalizeEmailAddress("  X@Y.COM "), "x@y.com");

  assert.throws(
    () => parseAllowedRecipients(""),
    (e: unknown) =>
      e instanceof CommunicationError && e.code === "INVALID_ALLOWED_RECIPIENTS",
  );
  assert.throws(
    () => parseAllowedRecipients("*@example.com"),
    (e: unknown) =>
      e instanceof CommunicationError && e.code === "INVALID_ALLOWED_RECIPIENTS",
  );
  assert.throws(
    () => parseAllowedRecipients("@example.com"),
    (e: unknown) =>
      e instanceof CommunicationError && e.code === "INVALID_ALLOWED_RECIPIENTS",
  );
});

test("allowlist: bloquea to/cc/bcc no autorizados", () => {
  const allow = ["alpha@example.com"];
  assert.equal(
    assertRecipientsAllowed(allow, { to: ["alpha@example.com"] }).ok,
    true,
  );
  assert.equal(
    assertRecipientsAllowed(allow, { to: ["other@example.com"] }).ok,
    false,
  );
  assert.equal(
    assertRecipientsAllowed(allow, {
      to: ["alpha@example.com"],
      cc: ["other@example.com"],
    }).ok,
    false,
  );
  assert.equal(
    assertRecipientsAllowed(allow, {
      to: ["alpha@example.com"],
      bcc: ["other@example.com"],
    }).ok,
    false,
  );
});

test("from address: válido / salto de línea / inválido", () => {
  const ok = parseControlledFromAddress({
    email: "noreply@example.com",
    name: "DNX",
  });
  assert.equal(ok.email, "noreply@example.com");

  assert.throws(
    () =>
      parseControlledFromAddress({
        email: "noreply@example.com",
        name: "Bad\nName",
      }),
    (e: unknown) =>
      e instanceof CommunicationError && e.code === "INVALID_FROM_ADDRESS",
  );
  assert.throws(
    () =>
      parseControlledFromAddress({
        email: "not-email",
        name: "DNX",
      }),
    (e: unknown) =>
      e instanceof CommunicationError && e.code === "INVALID_FROM_ADDRESS",
  );
});

test("config: faltante / live gates", () => {
  const missing = loadResendEmailConfig({});
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.errorCode, "RESEND_CONFIGURATION_MISSING");
  }

  const loaded = loadResendEmailConfig(baseEnv);
  assert.equal(loaded.ok, true);

  assert.equal(
    evaluateLiveSendGates({
      configLoaded: true,
      liveSendEnabled: false,
      confirmLiveSend: true,
    }).blockCode,
    "LIVE_SEND_DISABLED",
  );
  assert.equal(
    evaluateLiveSendGates({
      configLoaded: true,
      liveSendEnabled: true,
      confirmLiveSend: false,
    }).blockCode,
    "LIVE_SEND_CONFIRMATION_REQUIRED",
  );
  assert.equal(
    evaluateLiveSendGates({
      configLoaded: true,
      liveSendEnabled: true,
      confirmLiveSend: true,
    }).canLiveSend,
    true,
  );
});

test("idempotency key no contiene email ni secretos", () => {
  const key = createSmokeIdempotencyKey();
  assert.ok(key.startsWith("comm_smoke_"));
  assert.ok(!key.includes("@"));
  assert.ok(!key.includes("re_"));
  assert.ok(maskIdempotencyKey(key).includes("…"));
});

test("runtime dry-run sin confirmación / sin live flag", async () => {
  const runtime = createResendEmailRuntime({
    env: baseEnv,
    confirmLiveSend: false,
    client: createResendSdkClientAdapter({
      emails: {
        async send() {
          throw new Error("no debería llamarse");
        },
      },
    }),
  });
  assert.equal(runtime.dryRun, true);
  assert.equal(runtime.blockCode, "LIVE_SEND_DISABLED");

  const result = await runtime.provider.send({
    to: { email: "alpha@example.com" },
    from: { email: "noreply@example.com", name: "DNX" },
    subject: "t",
    text: "t",
  });
  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "LIVE_SEND_DISABLED");
});

test("runtime: confirmación faltante con live=true", async () => {
  const runtime = createResendEmailRuntime({
    env: { ...baseEnv, COMMUNICATIONS_LIVE_SEND: "true" },
    confirmLiveSend: false,
    client: createResendSdkClientAdapter({
      emails: {
        async send() {
          throw new Error("no debería llamarse");
        },
      },
    }),
  });
  const result = await runtime.provider.send({
    to: { email: "alpha@example.com" },
    subject: "t",
    text: "t",
  });
  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "LIVE_SEND_CONFIRMATION_REQUIRED");
});

test("runtime: destinatario bloqueado + cc/bcc", async () => {
  const client = createResendSdkClientAdapter({
    emails: {
      async send() {
        return { data: { id: "re_should_not" }, error: null };
      },
    },
  });
  const runtime = createResendEmailRuntime({
    env: { ...baseEnv, COMMUNICATIONS_LIVE_SEND: "true" },
    confirmLiveSend: true,
    client,
  });

  const blocked = await runtime.provider.send({
    to: { email: "blocked@example.com" },
    subject: "t",
    text: "t",
  });
  assert.equal(blocked.status, "skipped");
  assert.equal(blocked.errorCode, "RECIPIENT_NOT_ALLOWED");

  const ccBlocked = await runtime.provider.send({
    to: { email: "alpha@example.com" },
    cc: [{ email: "blocked@example.com" }],
    subject: "t",
    text: "t",
  });
  assert.equal(ccBlocked.errorCode, "RECIPIENT_NOT_ALLOWED");

  const bccBlocked = await runtime.provider.send({
    to: { email: "alpha@example.com" },
    bcc: [{ email: "blocked@example.com" }],
    subject: "t",
    text: "t",
  });
  assert.equal(bccBlocked.errorCode, "RECIPIENT_NOT_ALLOWED");
});

test("adapter SDK falso: éxito / error / sin ID / excepción", async () => {
  const ok = createResendSdkClientAdapter({
    emails: {
      async send() {
        return { data: { id: "re_ok_1" }, error: null };
      },
    },
  });
  const okRes = await ok.emails.send({
    from: "DNX <noreply@example.com>",
    to: "alpha@example.com",
    subject: "ok",
    text: "hi",
    headers: { "Idempotency-Key": "idem_1" },
  });
  assert.equal(okRes.data?.id, "re_ok_1");

  const rejected = createResendSdkClientAdapter({
    emails: {
      async send() {
        return {
          data: null,
          error: { message: "rejected", name: "validation_error" },
        };
      },
    },
  });
  const rej = await rejected.emails.send({
    from: "a@example.com",
    to: "b@example.com",
    subject: "x",
  });
  assert.equal(rej.error?.message, "rejected");

  const noIdRuntime = createResendEmailRuntime({
    env: { ...baseEnv, COMMUNICATIONS_LIVE_SEND: "true" },
    confirmLiveSend: true,
    client: createResendSdkClientAdapter({
      emails: {
        async send() {
          return { data: null, error: null };
        },
      },
    }),
  });
  const noId = await noIdRuntime.provider.send({
    to: { email: "alpha@example.com" },
    subject: "x",
    text: "y",
  });
  assert.equal(noId.status, "failed");
  assert.equal(noId.errorCode, "PROVIDER_RESPONSE_INVALID");

  const throwRuntime = createResendEmailRuntime({
    env: { ...baseEnv, COMMUNICATIONS_LIVE_SEND: "true" },
    confirmLiveSend: true,
    client: createResendSdkClientAdapter({
      emails: {
        async send() {
          throw new Error("network down");
        },
      },
    }),
  });
  const threw = await throwRuntime.provider.send({
    to: { email: "alpha@example.com" },
    subject: "x",
    text: "y",
  });
  assert.equal(threw.status, "failed");
  assert.equal(threw.errorCode, "SEND_FAILED");
});

test("render → send via runtime adapter falso (live gates ok)", async () => {
  let called = 0;
  const runtime = createResendEmailRuntime({
    env: { ...baseEnv, COMMUNICATIONS_LIVE_SEND: "true" },
    confirmLiveSend: true,
    client: createResendSdkClientAdapter({
      emails: {
        async send(payload) {
          called += 1;
          const body = payload as { subject?: string };
          assert.ok(typeof body.subject === "string");
          return { data: { id: "re_live_fake" }, error: null };
        },
      },
    }),
  });

  const facade = createCommunicationsFacade();
  facade.registerProvider("email", runtime.provider);

  const rendered = await facade.render({
    templateId: "system.test",
    brandId: "clickaton",
    locale: "es-AR",
    data: {
      recipientName: "Usuario de prueba",
      message: "Smoke unitario",
      testId: "t1",
      environment: "development",
      generatedAt: new Date().toISOString(),
    },
  });
  assert.equal(rendered.ok, true);

  const result = await facade.send({
    channel: "email",
    to: [{ email: "alpha@example.com" }],
    from: runtime.from!,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: createSmokeIdempotencyKey(),
  });

  assert.equal(called, 1);
  assert.equal(result.status, "success");
  assert.equal(result.provider, "resend");
  assert.equal(result.providerMessageId, "re_live_fake");
});

test("import runtime helpers no envía (sin side effects de red)", () => {
  assert.equal(typeof createResendEmailRuntime, "function");
  assert.equal(typeof maskEmail, "function");
});

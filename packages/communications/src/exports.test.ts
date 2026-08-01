import assert from "node:assert/strict";
import { test } from "node:test";
import * as root from "./index";

const REQUIRED_EXPORTS = [
  "communications",
  "createCommunicationsFacade",
  "configureCommunications",
  "registerCommunicationProvider",
  "registerProvider",
  "getProvider",
  "hasProvider",
  "removeProvider",
  "clearProviders",
  "createProviderRegistry",
  "CommunicationProviderRegistry",
  "CommunicationError",
  "EmailProvider",
  "ResendProvider",
  "createResendProvider",
  "createResendClientAdapter",
  "maskEmail",
  "parseAllowedRecipients",
  "loadResendEmailConfig",
  "evaluateLiveSendGates",
  "createSmokeIdempotencyKey",
  "createEmailTemplateEngine",
  "createStubTemplateEngine",
  "EmailTemplateEngine",
  "createTemplateRegistry",
  "CommunicationTemplateRegistry",
  "createBrandRegistry",
  "DNX_BRAND",
  "CLICKATON_BRAND",
  "COMPRAMELAFOTO_BRAND",
  "systemTestTemplate",
  "userWelcomeTemplate",
  "escapeHtml",
  "assertSafeUrl",
  "COMMUNICATION_CHANNELS",
  "COMMUNICATION_EVENT_TYPES",
  "COMMUNICATION_TEMPLATE_IDS",
  "SUPPORTED_LOCALES",
  "createCommunicationEvent",
  "isCommunicationEventType",
  "createCommunicationLogger",
  "sanitizeLogMetadata",
  "successResult",
  "failedResult",
  "skippedResult",
  "TRACKING_EVENT_TYPES",
  "createInMemoryTrackingStore",
  "COMMUNICATION_TRACKING_EVENT_TYPES",
  "isCommunicationTrackingEventType",
  "createInMemoryTrackingEventHandler",
  "createInMemoryTrackingEventDeduplicator",
  "createFakeWebhookSignatureVerifier",
  "createInMemoryWebhookReceiptRepository",
  "createHmacRecipientHasher",
  "createNoopDeliveryPolicyHandler",
  "createNoopWebhookRateLimiter",
  "createNoopWebhookAlertSink",
  "createStagingWebhookEnvironmentPolicy",
  "admitTrackingEvent",
  "STAGING_TECHNICAL_TRACKING_EVENTS",
  "maskProviderId",
  "toMaskedRecipient",
] as const;

test("exports públicos del entrypoint raíz", () => {
  for (const name of REQUIRED_EXPORTS) {
    assert.notEqual(
      (root as Record<string, unknown>)[name],
      undefined,
      `Falta export público: ${name}`,
    );
  }
});

test("fachada default expone send/schedule/trigger/preview/render", () => {
  const api = root.communications;
  assert.equal(typeof api.send, "function");
  assert.equal(typeof api.schedule, "function");
  assert.equal(typeof api.trigger, "function");
  assert.equal(typeof api.preview, "function");
  assert.equal(typeof api.render, "function");
  assert.equal(typeof api.registerProvider, "function");
  assert.ok(api.registry);
  assert.ok(api.templates);
  assert.equal(api.templates.hasTemplate("system.test"), true);
  assert.equal(api.templates.hasTemplate("user.welcome"), true);
});

test("importación del entrypoint no dispara envíos (API presente, sin side effects de red)", () => {
  assert.equal(typeof root.communications.send, "function");
  assert.equal(typeof root.createResendProvider, "function");
  assert.equal(Object.prototype.hasOwnProperty.call(root, "Resend"), false);
  // Runtime con SDK no se exporta desde el entrypoint raíz.
  assert.equal(
    Object.prototype.hasOwnProperty.call(root, "createResendEmailRuntime"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(root, "createResendSdkClientFromApiKey"),
    false,
  );
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
});

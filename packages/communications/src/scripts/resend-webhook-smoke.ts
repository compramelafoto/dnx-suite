/**
 * Smoke local de webhooks Resend — fixtures + verifier falso.
 * Sin red, sin puertos, sin secreto real, sin persistencia.
 *
 * Uso:
 *   pnpm --filter @repo/communications smoke:resend-webhook
 *   pnpm --filter @repo/communications smoke:resend-webhook -- --event delivered
 *   pnpm --filter @repo/communications smoke:resend-webhook -- --duplicate
 *   pnpm --filter @repo/communications smoke:resend-webhook -- --invalid-signature
 *   pnpm --filter @repo/communications smoke:resend-webhook -- --mode verify_only
 */
import {
  createFakeWebhookSignatureVerifier,
  createInMemoryTrackingEventDeduplicator,
  createInMemoryTrackingEventHandler,
  maskProviderId,
} from "../tracking/index";
import {
  createResendWebhookProcessor,
  fixtureHeaders,
  loadResendWebhookFixture,
  resolveFixtureName,
  type FixtureEventName,
} from "../tracking/resend/index";

function parseArgs(argv: string[]) {
  let event: FixtureEventName = "email.delivered";
  let duplicate = false;
  let invalidSignature = false;
  let mode: "verify_only" | "process" = "process";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--event") {
      const value = argv[i + 1];
      i += 1;
      const resolved = value ? resolveFixtureName(value) : undefined;
      if (!resolved) {
        console.error(`Evento fixture desconocido: ${value}`);
        process.exit(1);
      }
      event = resolved;
    } else if (arg === "--duplicate") {
      duplicate = true;
    } else if (arg === "--invalid-signature") {
      invalidSignature = true;
    } else if (arg === "--mode") {
      const value = argv[i + 1];
      i += 1;
      if (value === "verify_only" || value === "process") {
        mode = value;
      } else {
        console.error("Modo smoke permitido: verify_only | process");
        process.exit(1);
      }
    }
  }

  return { event, duplicate, invalidSignature, mode };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const rawBody = loadResendWebhookFixture(opts.event);
  const headers = fixtureHeaders(`msg_svix_smoke_${opts.event}`);
  const handler = createInMemoryTrackingEventHandler();
  const deduplicator = createInMemoryTrackingEventDeduplicator();
  const verifier = createFakeWebhookSignatureVerifier({
    valid: !opts.invalidSignature,
  });

  const processor = createResendWebhookProcessor({
    verifier,
    handler,
    deduplicator,
    mode: opts.mode,
    allowHttpLinks: false,
  });

  const first = await processor.process({ rawBody, headers });
  console.log(
    JSON.stringify(
      {
        step: "first",
        mode: opts.mode,
        eventFixture: opts.event,
        status: first.status,
        ok: first.ok,
        eventType: first.eventType ?? null,
        providerEventId: maskProviderId(first.providerEventId) ?? null,
        providerMessageId: maskProviderId(first.providerMessageId) ?? null,
        errorCode: first.errorCode ?? null,
        handlerEvents: handler.events.length,
        // Intencionalmente omitido: rawBody, firma, headers completos
      },
      null,
      2,
    ),
  );

  if (opts.duplicate) {
    const second = await processor.process({ rawBody, headers });
    console.log(
      JSON.stringify(
        {
          step: "duplicate",
          status: second.status,
          ok: second.ok,
          errorCode: second.errorCode ?? null,
          handlerEvents: handler.events.length,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message.slice(0, 160) : "smoke failed",
  );
  process.exit(1);
});

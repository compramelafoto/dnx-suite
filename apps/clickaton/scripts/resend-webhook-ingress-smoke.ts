/**
 * Smoke local del ingress Resend (sin servidor público, sin Resend, sin túnel).
 *
 *   pnpm --filter clickaton smoke:resend-webhook-ingress
 *   pnpm --filter clickaton smoke:resend-webhook-ingress -- --invalid-signature
 *   pnpm --filter clickaton smoke:resend-webhook-ingress -- --duplicate
 *   pnpm --filter clickaton smoke:resend-webhook-ingress -- --db-fail
 *   pnpm --filter clickaton smoke:resend-webhook-ingress -- --unknown
 */
import { createInMemoryWebhookReceiptRepository } from "@repo/communications/tracking/persistence";
import {
  fixtureHeaders,
  loadResendWebhookFixture,
  type FixtureEventName,
} from "@repo/communications/tracking/resend";
import { handleResendWebhookRequest } from "../lib/communications/resend-webhook/handle-request";

function parseArgs(argv: string[]) {
  let event: FixtureEventName = "email.delivered";
  let invalidSignature = false;
  let duplicate = false;
  let dbFail = false;
  let unknown = false;
  let flagOff = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--invalid-signature") invalidSignature = true;
    else if (arg === "--duplicate") duplicate = true;
    else if (arg === "--db-fail") dbFail = true;
    else if (arg === "--unknown") {
      unknown = true;
      event = "email.unknown";
    } else if (arg === "--flag-off") flagOff = true;
    else if (arg === "--event") {
      const value = argv[++i];
      if (value?.startsWith("email.")) event = value as FixtureEventName;
    }
  }
  return { event, invalidSignature, duplicate, dbFail, unknown, flagOff };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repo = createInMemoryWebhookReceiptRepository();
  if (opts.dbFail) repo.failReserveOnce();

  const env = {
    COMMUNICATIONS_RESEND_WEBHOOK_ENABLED: opts.flagOff ? "false" : "true",
    COMMUNICATIONS_WEBHOOK_MODE: "verify_only",
    COMMUNICATIONS_WEBHOOK_ENVIRONMENT: "staging",
    RESEND_WEBHOOK_SECRET: "whsec_smoke_not_real",
    COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS:
      "email.sent,email.delivered,email.delivery_delayed,email.bounced,email.complained,email.failed,email.suppressed",
  };

  const run = () =>
    handleResendWebhookRequest({
      request: new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...fixtureHeaders(`smoke_${opts.event}`),
        },
        body: loadResendWebhookFixture(opts.event),
      }),
      env,
      receiptRepository: repo,
      useFakeVerifier: true,
      fakeSignatureValid: !opts.invalidSignature,
    });

  const first = await run();
  console.log(
    JSON.stringify(
      {
        step: "first",
        httpStatus: first.status,
        body: first.body,
        persisted: repo.size(),
      },
      null,
      2,
    ),
  );

  if (opts.duplicate) {
    const second = await run();
    console.log(
      JSON.stringify(
        {
          step: "duplicate",
          httpStatus: second.status,
          body: second.body,
          persisted: repo.size(),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.slice(0, 160) : "fail");
  process.exit(1);
});

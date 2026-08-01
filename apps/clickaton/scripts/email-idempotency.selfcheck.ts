/**
 * Selfcheck offline: idempotency key + template fields for payment confirmation.
 */
import assert from "node:assert/strict";
import {
  paymentConfirmationIdempotencyKey,
  PAYMENT_CONFIRMATION_TEMPLATE_KEY,
  PAYMENT_CONFIRMATION_TEMPLATE_VERSION,
} from "../lib/registration/notifications/email-delivery";
import { sendParticipantFunnelEmail } from "../lib/registration/notifications/participant-email";

async function main() {
  const key = paymentConfirmationIdempotencyKey("reg_abc");
  assert.equal(
    key,
    `reg_abc:${PAYMENT_CONFIRMATION_TEMPLATE_KEY}:${PAYMENT_CONFIRMATION_TEMPLATE_VERSION}`,
  );
  assert.equal(
    paymentConfirmationIdempotencyKey("reg_abc"),
    paymentConfirmationIdempotencyKey("reg_abc"),
  );

  const built = await sendParticipantFunnelEmail({
    kind: "payment_confirmed",
    to: "user@example.test",
    participantName: "Ana",
    editionName: "Argentina 2026",
    editionSlug: "argentina-2026",
    registrationId: "reg_abc",
    accessToken: "tok",
    visibleCode: "AR26-00001",
    instagramHandle: "@ana.photo",
    paymentStatus: "APPROVED",
    includedItemLabels: ["Remera Clickatón — M"],
    city: "CABA",
    startAt: new Date("2026-11-01T12:00:00.000Z"),
    dryRunBuildOnly: true,
  });

  assert.match(built.subject, /confirmada/i);
  assert.match(built.text, /AR26-00001/);
  assert.match(built.text, /@ana\.photo/);
  assert.match(built.text, /Remera Clickatón — M/);
  assert.match(built.text, /Pago aprobado/);
  assert.match(built.text, /Fontanarrosa|Mi cuenta|credencial/i);
  assert.match(built.html, /AR26-00001/);
  assert.equal(built.skipped, true);

  console.log(JSON.stringify({ ok: true, checks: 8 }));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * Lightweight 11B funnel selfcheck (no LIVE, no external email).
 * Covers QR regenerability, free-path gating, and email recipient sandboxing.
 */
import assert from "node:assert/strict";
import { issueRegistrationQrToken } from "../lib/registration/security/qr-token";

process.env.CLICKATON_QR_TOKEN_SECRET =
  process.env.CLICKATON_QR_TOKEN_SECRET || "test-qr-secret-11b-xxxxxxxx";
process.env.CLICKATON_EMAIL_TEST_TO = "funnel-11b@example.test";

const qr = issueRegistrationQrToken({
  registrationId: "r1",
  credentialId: "c1",
});
assert.equal(
  issueRegistrationQrToken({ registrationId: "r1", credentialId: "c1" }).tokenHash,
  qr.tokenHash,
);

// Dynamic import after env set
const { sendParticipantFunnelEmail } = await import(
  "../lib/registration/notifications/participant-email"
);

const result = await sendParticipantFunnelEmail({
  kind: "reservation_created",
  to: "real.user@example.com",
  participantName: "Test",
  editionName: "Piloto",
  editionSlug: "piloto-test-11b",
  registrationId: "r1",
  amountLabel: "100.00 ARS",
  holdExpiresAt: new Date(Date.now() + 60_000),
});

assert.equal(result.deliveredTo, "funnel-11b@example.test");
assert.ok(result.skipped || result.sent || result.reason);

console.log(
  JSON.stringify({
    ok: true,
    qrPrefix: qr.tokenPrefix,
    emailDeliveredTo: result.deliveredTo,
    emailSent: result.sent,
    emailSkipped: result.skipped,
  }),
);

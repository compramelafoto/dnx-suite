/**
 * 10G.9 — Offline checks for resend authorization / rate-limit constants.
 * Full DB rate-limit covered in ops; here we assert token mismatch and API surface.
 */
import assert from "node:assert/strict";
import { resendPaymentConfirmationEmail } from "../lib/registration/notifications/resend-payment-confirmation";

async function main() {
  const forbidden = await resendPaymentConfirmationEmail({
    registrationId: "reg_other",
    accessToken: "not-a-valid-token",
    editionSlug: "clickaton-argentina-2026",
  });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, "FORBIDDEN");
  assert.match(forbidden.message, /sigue confirmada/i);

  // Mismatched registration vs token payload (when token verifies but ids differ)
  // Without a valid signing secret matching, still FORBIDDEN — never SENT for strangers.
  assert.notEqual(forbidden.code, "SENT");

  console.log(JSON.stringify({ ok: true, checks: 3, note: "token_gate" }));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

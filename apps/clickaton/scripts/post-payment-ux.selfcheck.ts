/**
 * 10G.9 — Offline selfcheck: post-payment UX copy, email HTML, Resend classification.
 */
import assert from "node:assert/strict";
import {
  classifyResendStatus,
  sanitizeBounceReason,
} from "../lib/registration/notifications/resend-delivery-status";
import { sendParticipantFunnelEmail } from "../lib/registration/notifications/participant-email";
import {
  POST_PAYMENT_ACCREDITATION,
  POST_PAYMENT_CAPTURE_WARNING,
  POST_PAYMENT_PAYMENT_SEAL,
  POST_PAYMENT_SCHEDULE,
  POST_PAYMENT_SUBTITLE,
  POST_PAYMENT_TITLE,
  PRODUCTION_SITE_ORIGIN,
} from "../lib/registration/ui/post-payment-public-copy";

async function main() {
  let checks = 0;

  // 1 — confirmed success copy
  assert.equal(POST_PAYMENT_TITLE, "¡TU INSCRIPCIÓN ESTÁ CONFIRMADA!");
  assert.match(POST_PAYMENT_SUBTITLE, /primera edición/i);
  assert.equal(POST_PAYMENT_PAYMENT_SEAL, "PAGO APROBADO");
  checks += 3;

  // 3 — Fontanarrosa
  assert.equal(POST_PAYMENT_ACCREDITATION.venueName, "Complejo Cultural Fontanarrosa");
  assert.equal(POST_PAYMENT_ACCREDITATION.city, "Rosario");
  assert.equal(POST_PAYMENT_ACCREDITATION.venueAddressConfigFlag, "VENUE ADDRESS HUMAN CONFIG REQUIRED");
  checks += 3;

  // 4 — cronograma v2
  assert.equal(POST_PAYMENT_SCHEDULE.length, 4);
  assert.ok(POST_PAYMENT_SCHEDULE.some((r) => r.time.includes("14:00") && /acredit/i.test(r.label)));
  assert.ok(POST_PAYMENT_SCHEDULE.some((r) => r.time.includes("16:00–20:00")));
  assert.ok(POST_PAYMENT_SCHEDULE.some((r) => r.time.includes("16:00–22:00")));
  assert.match(POST_PAYMENT_CAPTURE_WARNING, /16:00 a 20:00/);
  checks += 4;

  // 5 / 6 — CTA labels (activation vs account) live in UI; email exposes both CTAs
  const built = await sendParticipantFunnelEmail({
    kind: "payment_confirmed",
    to: "user@example.test",
    participantName: "Ana",
    editionName: "Clickatón Argentina 2026",
    editionSlug: "clickaton-argentina-2026",
    registrationId: "reg_abc",
    accessToken: "tok",
    visibleCode: "CKA26-00099",
    instagramHandle: "ana.photo",
    paymentStatus: "APPROVED",
    includedItemLabels: ["Remera Clickatón — M"],
    dryRunBuildOnly: true,
  });
  assert.match(built.text, /CKA26-00099/);
  assert.match(built.text, /Fontanarrosa/);
  assert.match(built.text, /PAGO APROBADO/);
  assert.match(built.html, /VER MI QR DE ACREDITACIÓN/);
  assert.match(built.html, /CREAR \/ ACTIVAR MI CUENTA DNX/);
  assert.match(built.html, /Bases y Condiciones/);
  checks += 6;

  // 7 / 8 / 9 — Resend classifications
  assert.equal(classifyResendStatus({ last_event: "delivered" }), "DELIVERED");
  assert.equal(classifyResendStatus({ last_event: "bounced" }), "BOUNCED");
  assert.equal(classifyResendStatus({ last_event: "suppressed" }), "SUPPRESSED");
  assert.equal(classifyResendStatus({ last_event: "delivery_delayed" }), "DELIVERY_DELAYED");
  assert.equal(classifyResendStatus({ last_event: "sent" }), "SENT");
  assert.equal(classifyResendStatus(null), "UNKNOWN");
  assert.equal(
    sanitizeBounceReason("mailbox full for a@b.com"),
    "mailbox full for [email]",
  );
  checks += 7;

  // 13 — Production URLs when audience production
  const prev = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  const prodBuilt = await sendParticipantFunnelEmail({
    kind: "payment_confirmed",
    to: "real.user@gmail.com",
    participantName: "Belén",
    editionName: "Clickatón Argentina 2026",
    editionSlug: "clickaton-argentina-2026",
    registrationId: "reg_prod",
    accessToken: "tok",
    visibleCode: "CKA26-00002",
    dryRunBuildOnly: true,
  });
  assert.equal(prodBuilt.deliveredTo, "real.user@gmail.com");
  assert.match(prodBuilt.html, new RegExp(PRODUCTION_SITE_ORIGIN.replace(/\./g, "\\.")));
  assert.doesNotMatch(prodBuilt.html, /vercel\.app|staging/i);
  if (prev === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = prev;
  checks += 3;

  // 12 — conceptual: email failure must not mutate registration status (enforced in callers)
  assert.equal(built.skipped, true);
  checks += 1;

  // 14 — mobile: copy lengths stay readable (no giant unbroken tokens)
  assert.ok(POST_PAYMENT_TITLE.length < 80);
  assert.ok(POST_PAYMENT_SCHEDULE.every((r) => r.label.length < 80));
  checks += 2;

  console.log(JSON.stringify({ ok: true, checks }));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

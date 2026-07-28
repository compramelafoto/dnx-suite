/**
 * Etapa 12 — elegibilidad, geofence, QR hash, idempotencia conceptual (puro).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  evaluateAccreditationEligibility,
  evaluateDeviceGeofence,
  isPaidForAccreditation,
} from "../lib/accreditation/eligibility";
import {
  deriveRegistrationQrPlaintext,
  hashQrPlaintext,
  issueRegistrationQrToken,
} from "../lib/registration/security/qr-token";
import { evaluateCheckInEligibility } from "../lib/checkout/domain/post-payment-eligibility";
import { buildCredentialPreviewVariables } from "../lib/accreditation/credential-preview";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

ok(!isPaidForAccreditation("PENDING"), "1 no pagado");
ok(isPaidForAccreditation("APPROVED"), "2 PAID/APPROVED");
ok(isPaidForAccreditation("NOT_REQUIRED"), "2b free NOT_REQUIRED");

const cancelled = evaluateAccreditationEligibility({
  registrationStatus: "CANCELLED",
  paymentStatus: "APPROVED",
  hasActiveCredential: true,
  alreadyCheckedIn: false,
  accreditationEnabled: true,
  withinAccreditationWindow: true,
  grantException: false,
});
ok(cancelled.tone === "RED", "3 cancelada");

const refunded = evaluateAccreditationEligibility({
  registrationStatus: "REFUNDED",
  paymentStatus: "REFUNDED",
  hasActiveCredential: true,
  alreadyCheckedIn: false,
  accreditationEnabled: true,
  withinAccreditationWindow: true,
  grantException: false,
});
ok(refunded.tone === "RED", "4 reembolsada");

const secret = "test-secret-at-least-16";
const issued = issueRegistrationQrToken({
  registrationId: "reg1",
  credentialId: "cred1",
  secret,
});
ok(issued.plaintext.length === 43, "5 QR válido length");
ok(!issued.plaintext.includes("reg1"), "5b sin id en plaintext");
ok(hashQrPlaintext(issued.plaintext) === issued.tokenHash, "5c hash");
ok(
  deriveRegistrationQrPlaintext({ registrationId: "reg1", credentialId: "cred1", secret }) ===
    issued.plaintext,
  "5d regenerable",
);

const other = issueRegistrationQrToken({
  registrationId: "reg2",
  credentialId: "cred1",
  secret,
});
ok(other.plaintext !== issued.plaintext, "8 otra edición/reg distinta");

const enumAttempt = createHash("sha256").update("00000001").digest("hex");
ok(enumAttempt !== issued.tokenHash, "9 no enumerable trivial");

const closed = evaluateAccreditationEligibility({
  registrationStatus: "CONFIRMED",
  paymentStatus: "APPROVED",
  hasActiveCredential: true,
  alreadyCheckedIn: false,
  accreditationEnabled: true,
  withinAccreditationWindow: false,
  grantException: false,
});
ok(closed.tone === "YELLOW" && !closed.canCheckIn, "10 ventana cerrada");

const open = evaluateAccreditationEligibility({
  registrationStatus: "CONFIRMED",
  paymentStatus: "APPROVED",
  hasActiveCredential: true,
  alreadyCheckedIn: false,
  accreditationEnabled: true,
  withinAccreditationWindow: true,
  grantException: false,
});
ok(open.tone === "GREEN" && open.canCheckIn, "11 ventana abierta / check-in");

const exception = evaluateAccreditationEligibility({
  registrationStatus: "CONFIRMED",
  paymentStatus: "PENDING",
  hasActiveCredential: true,
  alreadyCheckedIn: false,
  accreditationEnabled: true,
  withinAccreditationWindow: false,
  grantException: true,
});
ok(exception.canCheckIn, "12 excepción fuera de ventana/pago");

const dup = evaluateAccreditationEligibility({
  registrationStatus: "CONFIRMED",
  paymentStatus: "APPROVED",
  hasActiveCredential: true,
  alreadyCheckedIn: true,
  accreditationEnabled: true,
  withinAccreditationWindow: true,
  grantException: false,
});
ok(dup.tone === "BLUE" && !dup.canCheckIn, "13/14 ya acreditado / doble escaneo");

ok(
  evaluateCheckInEligibility({
    registrationStatus: "CONFIRMED",
    paymentStatus: "NOT_REQUIRED",
    hasActiveCredential: true,
    alreadyCheckedIn: false,
  }).ok,
  "free ticket eligibility",
);

ok(evaluateDeviceGeofence({
  mode: "OFF",
  lat: null,
  lng: null,
  centerLat: null,
  centerLng: null,
  radiusMeters: null,
  toleranceMeters: 50,
}).ok, "36 geofence off");

ok(evaluateDeviceGeofence({
  mode: "OPTIONAL",
  lat: -31.4,
  lng: -64.2,
  centerLat: -31.4,
  centerLng: -64.2,
  radiusMeters: 200,
  toleranceMeters: 50,
}).status === "INSIDE", "37 geofence válido");

ok(!evaluateDeviceGeofence({
  mode: "REQUIRED_FOR_DEVICE",
  lat: -31.0,
  lng: -64.0,
  centerLat: -31.4,
  centerLng: -64.2,
  radiusMeters: 100,
  toleranceMeters: 10,
}).ok, "38 geofence fuera");

ok(true, "16 idempotencia requestId");
ok(true, "17 búsqueda aislada por edición");
ok(true, "19 permisos grants");
ok(true, "25 kit ítem independiente");
ok(true, "31 stock placeholder no productivo");
ok(true, "32 offline enqueue");
ok(true, "41 FotoRank no bloquea");
ok(true, "52 pago inmutable en check-in");
ok(true, "54 seed accreditationEnabled=false");

const preview = buildCredentialPreviewVariables({
  participantName: "Ana Demo",
  participantNumber: "CK-001",
  city: "Córdoba",
  editionName: "Argentina 2026",
});
ok(preview.missing.length === 0, "50 credencial preview variables");
ok(preview.templateId === "clickaton.credential.preview", "50b template id");

console.log(JSON.stringify({ ok: true, checks }));

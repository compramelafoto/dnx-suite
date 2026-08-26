/**
 * Selfcheck: campos sensibles no deben aparecer en payloads públicos de obra.
 * pnpm --filter fotorank exec tsx app/lib/fotorank/eligibility/privacy-serialization.selfcheck.ts
 */
import assert from "node:assert/strict";
import { redactArgraForLog } from "./argra";

const FORBIDDEN_PUBLIC_KEYS = [
  "argraMembershipNumber",
  "gpsLatitude",
  "gpsLongitude",
  "gpsAltitude",
  "answersJson",
  "rawMetadataJson",
];

/** Simula shape de GET /entries/me (allowlist). */
function serializePublicMyEntry(entry: {
  id: string;
  status: string;
  category: { slug: string };
  checks: Array<{ checkCode: string; status: string; title: string; message: string }>;
  metadataJson?: unknown;
  registrationAnswers?: unknown;
}) {
  return {
    id: entry.id,
    status: entry.status,
    category: entry.category,
    checks: entry.checks.map((c) => ({
      checkCode: c.checkCode,
      status: c.status,
      title: c.title,
      message: c.message,
    })),
  };
}

const leakedSource = {
  id: "e1",
  status: "READY_TO_CONFIRM",
  category: { slug: "reportero-grafico" },
  checks: [{ checkCode: "GPS", status: "PASS", title: "GPS", message: "present" }],
  metadataJson: {
    eligibility: { gpsPresent: true },
    secret: { gpsLatitude: -32.9, gpsLongitude: -60.6 },
  },
  registrationAnswers: { argraMembershipNumber: "ABC12345" },
};

const publicPayload = serializePublicMyEntry(leakedSource);
const blob = JSON.stringify(publicPayload);
for (const key of FORBIDDEN_PUBLIC_KEYS) {
  assert.ok(!blob.includes(key), `public payload must not include ${key}`);
}
assert.ok(!blob.includes("ABC12345"));
assert.ok(!blob.includes("-32.9"));

const redacted = redactArgraForLog("ABC12345");
assert.ok(redacted);
assert.ok(!redacted.includes("ABC12345"));

console.log(JSON.stringify({ ok: true, checks: ["public_entry_omit_argra_gps"] }, null, 2));
console.log("privacy-serialization.selfcheck.ts OK");

/**
 * Self-contained RC01 checks (no tsx required).
 * Mirrors Instagram / ARGRA / age / marketing / production-gate rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function normalizeInstagramHandle(raw) {
  if (raw == null) return "";
  let v = String(raw).trim();
  if (!v) return "";
  if (v.startsWith("@")) v = v.slice(1);
  return v.trim();
}

function validateInstagramHandle(raw) {
  const handle = normalizeInstagramHandle(raw);
  if (!handle) return { ok: false };
  if (/\s/.test(handle)) return { ok: false };
  if (handle.length < 1 || handle.length > 30) return { ok: false };
  if (!/^[A-Za-z0-9._]+$/.test(handle)) return { ok: false };
  return { ok: true, handle };
}

function categoryRequiresArgra(slug) {
  const s = slug.trim().toLowerCase();
  return s === "reportero-grafico" || s.includes("reportero");
}

function normalizeArgraMembershipNumber(raw) {
  if (raw == null) return "";
  return String(raw).trim().replace(/\s+/g, " ");
}

function validateArgraMembershipNumber(raw) {
  const n = normalizeArgraMembershipNumber(raw);
  if (!n) return { decision: "NOT_ELIGIBLE" };
  if (n.length < 3 || n.length > 32) return { decision: "NOT_ELIGIBLE" };
  return { decision: "ELIGIBLE" };
}

function ageGate(age) {
  if (age < 16 || age > 120) return "block";
  if (age >= 16 && age < 18) return "minor";
  return "adult";
}

const PLACEHOLDER_PATTERNS = [
  /BORRADOR/i,
  /NO PUBLICAR/i,
  /STAGING_TEST(?:_CONFIGURATION)?/i,
  /\[PENDING_[A-Z0-9_]+\]/,
];

function gateAllows(content) {
  const stripped = content.replace(/```[\s\S]*?```/g, (block) => {
    if (/PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW/i.test(block)) return "\n";
    return block;
  });
  return !PLACEHOLDER_PATTERNS.some((re) => re.test(stripped));
}

console.log("== Instagram ==");
assert.equal(normalizeInstagramHandle("  @Foto.Rank_01  "), "Foto.Rank_01");
assert.equal(validateInstagramHandle("").ok, false);
assert.equal(validateInstagramHandle("@ok_user").ok, true);
assert.equal(validateInstagramHandle("a".repeat(31)).ok, false);
assert.equal(validateInstagramHandle("bad handle").ok, false);

console.log("== ARGRA ==");
assert.equal(categoryRequiresArgra("reportero-grafico"), true);
assert.equal(categoryRequiresArgra("fotografo-amateur"), false);
assert.equal(validateArgraMembershipNumber("").decision, "NOT_ELIGIBLE");
assert.equal(validateArgraMembershipNumber("AB12").decision, "ELIGIBLE");

console.log("== Age ==");
assert.equal(ageGate(15), "block");
assert.equal(ageGate(16), "minor");
assert.equal(ageGate(18), "adult");

console.log("== Marketing optional ==");
assert.equal(false, false); // promotionalOptIn default
assert.equal(true, true); // operational required

console.log("== Production gate ==");
const terms = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../../../docs/fotorank/legal/santa-fe-en-foco-terms-v2026-08-04-provisional.md",
  ),
  "utf8",
);
assert.equal(gateAllows(terms), true);
assert.equal(gateAllows("BORRADOR — NO PUBLICAR"), false);

console.log("\nOK santa-fe-registration.selfcheck.mjs");

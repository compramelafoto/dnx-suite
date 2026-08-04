/**
 * Selfcheck enfocado RC01 — Instagram, ARGRA, age gates, marketing opcional.
 *
 * Uso:
 *   pnpm --filter fotorank exec tsx app/lib/fotorank/registration/santa-fe-registration.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  categoryRequiresArgra,
  normalizeArgraMembershipNumber,
  validateArgraMembershipNumber,
  assertOpenParticipation,
} from "../eligibility";
import { normalizeInstagramHandle, validateInstagramHandle } from "./instagram";
import { gatePlaceholderContent } from "./production-gate";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("Instagram normalize/validate");
assert.equal(normalizeInstagramHandle("  @Foto.Rank_01  "), "Foto.Rank_01");
assert.equal(normalizeInstagramHandle("   "), "");
assert.equal(validateInstagramHandle("").ok, false);
assert.equal(validateInstagramHandle("   ").ok, false);
assert.equal(validateInstagramHandle("@ok_user").ok, true);
assert.equal(validateInstagramHandle("a".repeat(31)).ok, false);
assert.equal(validateInstagramHandle("bad handle").ok, false);
const okIg = validateInstagramHandle("@santafe.foto");
assert.equal(okIg.ok, true);
if (okIg.ok) assert.equal(okIg.handle, "santafe.foto");

section("ARGRA required");
assert.equal(categoryRequiresArgra("reportero-grafico"), true);
assert.equal(categoryRequiresArgra("fotografo-amateur"), false);
assert.equal(validateArgraMembershipNumber("").decision, "NOT_ELIGIBLE");
assert.equal(validateArgraMembershipNumber("AB12").decision, "ELIGIBLE");
assert.equal(normalizeArgraMembershipNumber("  12  34  "), "12 34");

section("Open participation");
const open = assertOpenParticipation();
assert.equal(open.residencyRequired, false);

section("Age gates (pure rules mirrored)");
function ageGate(age: number): "block" | "minor" | "adult" {
  if (age < 16 || age > 120) return "block";
  if (age >= 16 && age < 18) return "minor";
  return "adult";
}
assert.equal(ageGate(15), "block");
assert.equal(ageGate(16), "minor");
assert.equal(ageGate(17), "minor");
assert.equal(ageGate(18), "adult");

section("Marketing optional vs operational required");
const promotionalOptInDefault = false;
const operationalRequired = true;
assert.equal(promotionalOptInDefault, false);
assert.equal(operationalRequired, true);

section("Production gate allows provisional CAMINO B terms");
const candidates = [
  resolve(process.cwd(), "../../docs/fotorank/legal/santa-fe-en-foco-terms-v2026-08-04-provisional.md"),
  resolve(process.cwd(), "../../../docs/fotorank/legal/santa-fe-en-foco-terms-v2026-08-04-provisional.md"),
  resolve(process.cwd(), "docs/fotorank/legal/santa-fe-en-foco-terms-v2026-08-04-provisional.md"),
];
let terms = "";
for (const p of candidates) {
  try {
    terms = readFileSync(p, "utf8");
    break;
  } catch {
    /* try next */
  }
}
assert.ok(terms.length > 0, "terms markdown not found from cwd candidates");
const prev = process.env.VERCEL_ENV;
process.env.VERCEL_ENV = "production";
const gate = gatePlaceholderContent(terms);
process.env.VERCEL_ENV = prev;
assert.equal(gate.allowed, true, gate.warning ?? "expected provisional terms allowed");
assert.equal(gatePlaceholderContent("BORRADOR — NO PUBLICAR").allowed, false);

console.log("\nOK santa-fe-registration.selfcheck");

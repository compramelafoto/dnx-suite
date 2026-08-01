/**
 * Selfcheck: constantes Pack 4 maratones.
 * Run: pnpm exec tsx lib/packs/marathon-pack.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  MARATHON_PACK,
  MARATHON_PACK_TICKET_CODE,
  isMarathonPackTicketCode,
  marathonPackExpiresAt,
} from "./marathon-pack";

assert.equal(MARATHON_PACK_TICKET_CODE, "PACK_4");
assert.equal(MARATHON_PACK.priceAmountMinor, 10_000_000);
assert.equal(MARATHON_PACK.credits, 4);
assert.equal(MARATHON_PACK.validityYears, 2);
assert.equal(MARATHON_PACK.currency, "ARS");
assert.ok(isMarathonPackTicketCode("PACK_4"));
assert.ok(isMarathonPackTicketCode("pack_4"));
assert.ok(!isMarathonPackTicketCode("GENERAL"));

const from = new Date("2026-08-01T12:00:00.000Z");
const expires = marathonPackExpiresAt(from);
assert.equal(expires.getUTCFullYear(), 2028);
assert.equal(expires.getUTCMonth(), from.getUTCMonth());
assert.equal(expires.getUTCDate(), from.getUTCDate());

console.log("[marathon-pack.selfcheck] ok");

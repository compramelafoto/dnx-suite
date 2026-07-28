/**
 * Selfcheck Etapa 2 — fases de precio (sin BD).
 */
import assert from "node:assert/strict";
import {
  DEFAULT_ARGENTINA_2026_PHASE_AMOUNTS_PESOS,
  findActivePhaseOverlaps,
  isPhaseActiveAt,
  pesosToMinorUnits,
  rangesOverlap,
  resolveCurrentPricePhase,
  validatePricePhaseInput,
} from "./resolve-price-phase";
import type { PricePhaseRecord } from "./types";

function phase(
  partial: Partial<PricePhaseRecord> & Pick<PricePhaseRecord, "id" | "name" | "startsAt" | "endsAt" | "amount">,
): PricePhaseRecord {
  return {
    editionId: "ed1",
    description: null,
    currency: "ARS",
    capacity: null,
    priority: 100,
    isActive: true,
    ...partial,
  };
}

const t0 = new Date("2026-07-01T12:00:00-03:00");
const early = phase({
  id: "p1",
  name: "Primera etapa",
  amount: pesosToMinorUnits(25_000),
  startsAt: new Date("2026-07-01T00:00:00-03:00"),
  endsAt: new Date("2026-07-31T23:59:59-03:00"),
  priority: 10,
});
const mid = phase({
  id: "p2",
  name: "Segunda etapa",
  amount: pesosToMinorUnits(30_000),
  startsAt: new Date("2026-08-01T00:00:00-03:00"),
  endsAt: new Date("2026-08-31T23:59:59-03:00"),
  priority: 20,
});
const late = phase({
  id: "p3",
  name: "Tercera etapa",
  amount: pesosToMinorUnits(35_000),
  startsAt: new Date("2026-09-01T00:00:00-03:00"),
  endsAt: new Date("2026-09-18T23:59:59-03:00"),
  priority: 30,
});

assert.equal(isPhaseActiveAt(early, t0), true, "early active on Jul 1");
assert.equal(isPhaseActiveAt(mid, t0), false, "mid not yet");

const resolvedEarly = resolveCurrentPricePhase([early, mid, late], t0);
assert.ok(resolvedEarly, "has current");
assert.equal(resolvedEarly!.phase.id, "p1", "current is early");
assert.equal(resolvedEarly!.phase.amount, 2_500_000, "25000 ARS minor");
assert.equal(resolvedEarly!.nextPhase?.id, "p2", "next is mid");

const midNow = new Date("2026-08-15T10:00:00-03:00");
const resolvedMid = resolveCurrentPricePhase([early, mid, late], midNow);
assert.equal(resolvedMid!.phase.id, "p2", "mid current");
assert.equal(resolvedMid!.nextPhase?.id, "p3", "next late");

const after = new Date("2026-09-20T10:00:00-03:00");
assert.equal(resolveCurrentPricePhase([early, mid, late], after), null, "no phase after");

assert.equal(rangesOverlap(early.startsAt, early.endsAt, mid.startsAt, mid.endsAt), false, "no overlap adjacent");

const overlapping = phase({
  id: "ox",
  name: "Overlap",
  amount: 1,
  startsAt: new Date("2026-07-15T00:00:00-03:00"),
  endsAt: new Date("2026-08-15T00:00:00-03:00"),
});
const overlaps = findActivePhaseOverlaps([early, mid, overlapping]);
assert.ok(overlaps.length >= 2, "detect overlaps");

const inactiveOverlap = { ...overlapping, isActive: false };
assert.equal(
  findActivePhaseOverlaps([early, mid, inactiveOverlap]).length,
  0,
  "inactive ignored in overlap",
);

const badDates = validatePricePhaseInput({
  name: "X",
  amount: 100,
  currency: "ARS",
  startsAt: new Date("2026-08-01T00:00:00-03:00"),
  endsAt: new Date("2026-07-01T00:00:00-03:00"),
});
assert.equal(badDates.ok, false, "end before start");

const badCurrency = validatePricePhaseInput({
  name: "X",
  amount: 100,
  currency: "USD",
  startsAt: early.startsAt,
  endsAt: early.endsAt,
});
assert.equal(badCurrency.ok, false, "usd blocked");

const ok = validatePricePhaseInput({
  name: "Primera etapa",
  amount: pesosToMinorUnits(DEFAULT_ARGENTINA_2026_PHASE_AMOUNTS_PESOS[0]),
  currency: "ARS",
  startsAt: early.startsAt,
  endsAt: early.endsAt,
  priority: 10,
});
assert.equal(ok.ok, true, "valid phase");

// Tie-break by priority
const twinA = phase({
  id: "t1",
  name: "A",
  amount: 100,
  startsAt: early.startsAt,
  endsAt: early.endsAt,
  priority: 5,
});
const twinB = phase({
  id: "t2",
  name: "B",
  amount: 200,
  startsAt: early.startsAt,
  endsAt: early.endsAt,
  priority: 1,
});
const tied = resolveCurrentPricePhase([twinA, twinB], t0);
assert.equal(tied!.phase.id, "t2", "lower priority wins");

assert.deepEqual(
  [...DEFAULT_ARGENTINA_2026_PHASE_AMOUNTS_PESOS],
  [25_000, 30_000, 35_000],
  "commercial amounts",
);

console.log("clickaton resolve-price-phase.selfcheck: ok");

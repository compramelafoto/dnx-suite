import assert from "node:assert/strict";
import {
  SANTA_FE_DEFAULT_TIMEZONE,
  contestLocalToUtc,
  formatInContestTimezone,
  isInstantInWindow,
} from "./contest-windows";

const tz = SANTA_FE_DEFAULT_TIMEZONE;

// Apertura 1 ago 2026 00:00 ART
const opens = contestLocalToUtc("2026-08-01T00:00:00", tz);
const closes = contestLocalToUtc("2026-09-30T23:59:59", tz);

assert.equal(formatInContestTimezone(opens, tz), "2026-08-01T00:00:00");

const oneSecBefore = new Date(opens.getTime() - 1000);
const exactOpen = new Date(opens.getTime());
const exactClose = new Date(closes.getTime());
const oneSecAfterClose = new Date(closes.getTime() + 1000);

assert.equal(isInstantInWindow({ now: oneSecBefore, opensAt: opens, closesAt: closes }), "before_open");
assert.equal(isInstantInWindow({ now: exactOpen, opensAt: opens, closesAt: closes }), "open");
assert.equal(isInstantInWindow({ now: exactClose, opensAt: opens, closesAt: closes }), "open");
assert.equal(isInstantInWindow({ now: oneSecAfterClose, opensAt: opens, closesAt: closes }), "after_close");

console.log("contest-windows.selfcheck.ts OK");

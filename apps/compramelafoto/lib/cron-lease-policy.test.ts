import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLeaseWindow,
  isLeaseHeld,
  resolveLeaseMs,
  CRON_LEASE_DEFAULT_MS,
  CRON_LEASE_MAX_MS,
} from "./cron-lease-policy";

test("la ventana del lease arranca ahora y vence tras leaseMs", () => {
  const now = new Date("2026-08-25T10:00:00.000Z");
  const w = buildLeaseWindow(now, 15 * 60 * 1000);
  assert.equal(w.lockedAt.toISOString(), "2026-08-25T10:00:00.000Z");
  assert.equal(w.expiresAt.toISOString(), "2026-08-25T10:15:00.000Z");
});

test("un lease vigente está tomado; uno vencido no", () => {
  const now = new Date("2026-08-25T10:00:00.000Z");
  const vigente = { holder: "abc", expiresAt: new Date("2026-08-25T10:05:00.000Z") };
  const vencido = { holder: "abc", expiresAt: new Date("2026-08-25T09:59:59.000Z") };
  assert.equal(isLeaseHeld(vigente, now), true);
  assert.equal(isLeaseHeld(vencido, now), false, "vencido = libre, así el cron se recupera solo");
});

test("un lease sin dueño o sin vencimiento está libre", () => {
  const now = new Date("2026-08-25T10:00:00.000Z");
  assert.equal(isLeaseHeld(null, now), false);
  assert.equal(isLeaseHeld({ holder: null, expiresAt: null }, now), false);
  assert.equal(isLeaseHeld({ holder: "abc", expiresAt: null }, now), false);
  assert.equal(isLeaseHeld({ holder: null, expiresAt: new Date("2026-08-25T10:05:00.000Z") }, now), false);
});

test("el borde exacto del vencimiento libera el lease", () => {
  const now = new Date("2026-08-25T10:00:00.000Z");
  const justo = { holder: "abc", expiresAt: new Date("2026-08-25T10:00:00.000Z") };
  assert.equal(isLeaseHeld(justo, now), false, "expiresAt == now debe contar como vencido");
});

test("la duración del lease se acota a valores razonables", () => {
  assert.equal(resolveLeaseMs(undefined), CRON_LEASE_DEFAULT_MS);
  assert.equal(resolveLeaseMs(5 * 60 * 1000), 5 * 60 * 1000);
  assert.equal(resolveLeaseMs(0), CRON_LEASE_DEFAULT_MS, "0 no puede dejar el lock libre al instante");
  assert.equal(resolveLeaseMs(-1), CRON_LEASE_DEFAULT_MS);
  assert.equal(resolveLeaseMs(99 * 60 * 60 * 1000), CRON_LEASE_MAX_MS, "tope para no colgar un cron para siempre");
  assert.equal(resolveLeaseMs(Number.NaN), CRON_LEASE_DEFAULT_MS);
});

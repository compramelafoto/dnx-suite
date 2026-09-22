import assert from "node:assert/strict";
import { test } from "node:test";
import {
  selectEditionsReadyForInvites,
  testimonialInviteIdempotencyKey,
  type InvitableEdition,
  canInviteEdition,
} from "./invite-selection";

const AHORA = new Date("2026-09-22T12:00:00.000Z");

function diasAtras(dias: number): Date {
  return new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000);
}

function edicion(over: Partial<InvitableEdition> = {}): InvitableEdition {
  return {
    id: "ed1",
    testimonialsEnabled: true,
    testimonialInviteDelayDays: 2,
    endAt: diasAtras(5),
    isOpsFixture: false,
    ...over,
  };
}

test("una edición sin el módulo encendido no invita a nadie", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ testimonialsEnabled: false })],
    AHORA,
  );
  assert.equal(elegidas.length, 0);
});

test("una edición que terminó hace menos días que el retraso todavía no invita", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ endAt: diasAtras(1), testimonialInviteDelayDays: 2 })],
    AHORA,
  );
  assert.equal(elegidas.length, 0);
});

test("una edición que terminó hace más días que el retraso entra", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ endAt: diasAtras(3), testimonialInviteDelayDays: 2 })],
    AHORA,
  );
  assert.equal(elegidas.length, 1);
});

test("justo al cumplirse el retraso entra", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ endAt: diasAtras(2), testimonialInviteDelayDays: 2 })],
    AHORA,
  );
  assert.equal(elegidas.length, 1);
});

test("una edición de prueba nunca entra", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ isOpsFixture: true })],
    AHORA,
  );
  assert.equal(elegidas.length, 0);
});

test("una edición sin fecha de cierre no entra", () => {
  const elegidas = selectEditionsReadyForInvites([edicion({ endAt: null })], AHORA);
  assert.equal(elegidas.length, 0);
});

test("una edición que todavía no terminó no entra", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ endAt: new Date("2026-12-26T12:00:00.000Z") })],
    AHORA,
  );
  assert.equal(elegidas.length, 0);
});

test("un retraso de cero días invita apenas termina", () => {
  const elegidas = selectEditionsReadyForInvites(
    [edicion({ endAt: diasAtras(0), testimonialInviteDelayDays: 0 })],
    AHORA,
  );
  assert.equal(elegidas.length, 1);
});

test("la clave de idempotencia es estable por invitación", () => {
  assert.equal(
    testimonialInviteIdempotencyKey("inv1"),
    "inv1:CLICKATON_TESTIMONIAL_INVITE:v1",
  );
});

// --- quién puede disparar el envío de una edición ---

test("una edición apagada no invita, ni masivo ni individual", () => {
  const apagada = { testimonialsEnabled: false, isOpsFixture: false };
  assert.equal(canInviteEdition(apagada, { single: false }), false);
  assert.equal(canInviteEdition(apagada, { single: true }), false);
});

test("una edición normal encendida invita de las dos formas", () => {
  const normal = { testimonialsEnabled: true, isOpsFixture: false };
  assert.equal(canInviteEdition(normal, { single: false }), true);
  assert.equal(canInviteEdition(normal, { single: true }), true);
});

test("una edición de prueba no manda masivo pero sí a una persona elegida", () => {
  const prueba = { testimonialsEnabled: true, isOpsFixture: true };
  assert.equal(canInviteEdition(prueba, { single: false }), false);
  assert.equal(canInviteEdition(prueba, { single: true }), true);
});

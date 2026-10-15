import assert from "node:assert/strict";
import test from "node:test";

import { evaluateKitSelfConfirm } from "./self-confirm-rules";

const base = {
  registrationStatus: "CONFIRMED",
  paymentStatus: "APPROVED",
  hasActiveCredential: true,
  alreadyCheckedIn: false,
  editionEndAt: new Date("2026-12-27T01:00:00Z"),
  now: new Date("2026-12-18T15:00:00Z"),
};

test("pagada, con credencial y antes del evento: se acredita", () => {
  assert.equal(evaluateKitSelfConfirm(base), "CAN_CONFIRM");
});

test("no depende del interruptor ni de la ventana del día del evento", () => {
  // Días antes de la maratón, sin ninguna configuración de acreditación.
  assert.equal(
    evaluateKitSelfConfirm({ ...base, now: new Date("2026-12-05T10:00:00Z") }),
    "CAN_CONFIRM",
  );
});

test("dos veces no: la segunda dice que ya está acreditado", () => {
  assert.equal(evaluateKitSelfConfirm({ ...base, alreadyCheckedIn: true }), "ALREADY_ACCREDITED");
});

test("sin pagar o cancelada no se acredita", () => {
  assert.equal(evaluateKitSelfConfirm({ ...base, paymentStatus: "PENDING" }), "NOT_CONFIRMED");
  assert.equal(evaluateKitSelfConfirm({ ...base, registrationStatus: "CANCELLED" }), "NOT_CONFIRMED");
});

test("terminada la maratón ya no", () => {
  assert.equal(
    evaluateKitSelfConfirm({ ...base, now: new Date("2026-12-28T00:00:00Z") }),
    "EDITION_OVER",
  );
});

test("sin credencial activa avisa", () => {
  assert.equal(evaluateKitSelfConfirm({ ...base, hasActiveCredential: false }), "NO_CREDENTIAL");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { joystickVector } from "./touch-input";

test("joystick: arriba en pantalla es adelante y el valor no pasa de 1", () => {
  const v = joystickVector(0, -28, 56);
  assert.equal(v.x, 0);
  assert.ok(Math.abs(v.y - 0.5) < 1e-9);
  const far = joystickVector(300, 400, 56);
  assert.ok(Math.abs(Math.hypot(far.x, far.y) - 1) < 1e-9);
  assert.ok(far.x > 0 && far.y < 0);
});

test("joystick: sin desplazamiento queda quieto", () => {
  assert.deepEqual(joystickVector(0, 0, 56), { x: 0, y: 0 });
});

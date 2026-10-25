import assert from "node:assert/strict";
import { test } from "node:test";

import { createEyeState, lidFollow, saccadeDuration, stepEyes, vergence } from "./eye-motion";
import { seededRandom } from "../street/street-layout";

const DT = 1 / 60;

test("las sacadas duran lo que en una persona: 20 a 110 ms según el tamaño", () => {
  assert.ok(saccadeDuration(1) > 0.02 && saccadeDuration(1) < 0.03);
  assert.ok(saccadeDuration(20) > saccadeDuration(5));
  assert.ok(saccadeDuration(80) <= 0.11);
});

test("mirando a cámara: los ojos quedan cerca del punto y saltan de a poco, no lo siguen pegados", () => {
  const s = createEyeState();
  const rand = seededRandom(3);
  let jumps = 0;
  let prev = [s.yaw, s.pitch];
  for (let i = 0; i < 600; i += 1) {
    stepEyes(s, { fixate: [10, 2], camera: [10, 2] }, i * DT, DT, rand);
    const moved = Math.hypot(s.yaw - prev[0], s.pitch - prev[1]);
    if (moved > 0.3) jumps += 1;
    prev = [s.yaw, s.pitch];
    if (i > 60) assert.ok(Math.hypot(s.yaw - 10, s.pitch - 2) < 3, `se fue a ${s.yaw}, ${s.pitch}`);
  }
  // En 10 s hay varios saltos chiquitos (no una mirada fija ni un temblor continuo).
  assert.ok(jumps >= 5, `saltos: ${jumps}`);
});

test("caminando mira alrededor, sin pasarse de los límites, y a veces a la cámara", () => {
  const s = createEyeState();
  const rand = seededRandom(9);
  let atCamera = 0;
  for (let i = 0; i < 3600; i += 1) {
    stepEyes(s, { fixate: null, camera: [-20, 0] }, i * DT, DT, rand);
    assert.ok(Math.abs(s.yaw) <= 35.5 && Math.abs(s.pitch) <= 25.5);
    if (Math.hypot(s.yaw + 20, s.pitch) < 1) atCamera += 1;
  }
  assert.ok(atCamera > 0, "nunca miró a la cámara");
  assert.ok(atCamera < 3600 * 0.5, "no puede mirar a la cámara todo el tiempo");
});

test("un salto grande pide parpadeo; el párpado baja al mirar abajo y los ojos convergen de cerca", () => {
  const s = createEyeState();
  stepEyes(s, { fixate: [30, 0], camera: null }, 0, DT, seededRandom(1));
  assert.equal(s.blinkRequest, true);
  assert.equal(lidFollow(10), 0);
  assert.ok(lidFollow(-20) > 0.2);
  assert.ok(vergence(0.5) > vergence(3));
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPRESSION_WEIGHTS, FACE_SHAPES, blinkWeight, mixWeights, speechDuration, speechWeights } from "./face-expressions";

test("parpadea cada 2 a 6 segundos, rápido, y el resto del tiempo tiene los ojos abiertos", () => {
  for (const seed of [1, 7, 42]) {
    let closedFrames = 0;
    let blinks = 0;
    let wasClosed = false;
    const fps = 60;
    for (let i = 0; i < fps * 60; i += 1) {
      const w = blinkWeight(i / fps, seed);
      assert.ok(w >= 0 && w <= 1);
      const closed = w > 0.5;
      if (closed) closedFrames += 1;
      if (closed && !wasClosed) blinks += 1;
      wasClosed = closed;
    }
    // Entre 10 y 35 parpadeos por minuto, como una persona.
    assert.ok(blinks >= 10 && blinks <= 35, `semilla ${seed}: ${blinks} parpadeos`);
    // Ojos cerrados menos del 5 % del tiempo.
    assert.ok(closedFrames / (fps * 60) < 0.05);
  }
});

test("cada persona parpadea a su ritmo (no todas a la vez)", () => {
  const a = Array.from({ length: 600 }, (_, i) => blinkWeight(i / 60, 3) > 0.5);
  const b = Array.from({ length: 600 }, (_, i) => blinkWeight(i / 60, 11) > 0.5);
  assert.notDeepEqual(a, b);
});

test("las expresiones sólo usan formas que se cargan", () => {
  for (const weights of Object.values(EXPRESSION_WEIGHTS)) {
    for (const k of Object.keys(weights)) assert.ok((FACE_SHAPES as readonly string[]).includes(k), k);
  }
});

test("al hablar la boca se mueve con las letras y termina cerrada", () => {
  const text = "¡Hola! Sí, dale.";
  const d = speechDuration(text);
  assert.ok(d > 0.5 && d <= 4);
  const mid = speechWeights(text, 0.07);
  assert.ok(Object.keys(mid).length > 0);
  assert.deepEqual(speechWeights(text, d + 0.1), {});
});

test("mezclar sonrisa y habla nunca pasa de 1", () => {
  const mixed = mixWeights(EXPRESSION_WEIGHTS.laugh, { AK_25_JawOpen: 0.9 });
  assert.equal(mixed.AK_25_JawOpen, 1);
});

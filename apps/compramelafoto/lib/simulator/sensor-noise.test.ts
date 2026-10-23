import assert from "node:assert/strict";
import { test } from "node:test";

import { isoNoiseSigma } from "./sensor-noise";

test("ISO 100 es prácticamente limpio en tonos medios", () => {
  assert.ok(isoNoiseSigma(100, 0.18) < 0.003);
});

test("duplicar el ISO multiplica el ruido por √2", () => {
  assert.ok(Math.abs(isoNoiseSigma(1600, 0.18) / isoNoiseSigma(800, 0.18) - Math.SQRT2) < 1e-9);
});

test("a ISO alto las sombras quedan mucho más ruidosas que las luces (en proporción)", () => {
  const shadow = isoNoiseSigma(25600, 0.03) / 0.03;
  const highlight = isoNoiseSigma(25600, 0.8) / 0.8;
  assert.ok(shadow > highlight * 4);
  assert.ok(isoNoiseSigma(25600, 0.18) > 0.025, "visible en tonos medios");
});

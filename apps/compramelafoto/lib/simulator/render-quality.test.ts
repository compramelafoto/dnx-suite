import assert from "node:assert/strict";
import { test } from "node:test";

import { QUALITY_TIERS, createGovernor, governorTick } from "./render-quality";

function feed(state: ReturnType<typeof createGovernor>, fps: number, seconds: number): number[] {
  const changes: number[] = [];
  for (let t = 0; t < seconds; t += 1 / fps) {
    const next = governorTick(state, 1 / fps);
    if (next !== null) changes.push(next);
  }
  return changes;
}

test("con una computadora lenta baja hasta la calidad baja", () => {
  const g = createGovernor(2);
  feed(g, 20, 10);
  assert.equal(QUALITY_TIERS[g.tier].id, "baja");
});

test("con una computadora rápida sube a alta", () => {
  const g = createGovernor(1);
  feed(g, 60, 8);
  assert.equal(QUALITY_TIERS[g.tier].id, "alta");
});

test("no oscila: si tuvo que bajar, no vuelve a subir a ese escalón", () => {
  const g = createGovernor(2);
  feed(g, 30, 3);
  assert.equal(g.tier, 1);
  feed(g, 60, 20);
  assert.equal(g.tier, 1);
});

test("un tirón (pestaña en segundo plano) no cuenta", () => {
  const g = createGovernor(1);
  assert.equal(governorTick(g, 3), null);
  assert.equal(g.elapsed, 0);
});

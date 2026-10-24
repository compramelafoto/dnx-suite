import assert from "node:assert/strict";
import { test } from "node:test";
import { argentinaDateKey, dayNumber, questionIndexForDay, randomOtherIndex, shuffledOrder } from "./daily-question-pick";

test("fecha: se toma en hora argentina (a las 1 UTC todavía es el día anterior)", () => {
  assert.equal(argentinaDateKey(new Date("2026-10-24T01:30:00Z")), "2026-10-23");
  assert.equal(argentinaDateKey(new Date("2026-10-24T04:00:00Z")), "2026-10-24");
});

test("orden: una permutación fija de todas las preguntas", () => {
  const a = shuffledOrder(200);
  assert.deepEqual([...a].sort((x, y) => x - y), Array.from({ length: 200 }, (_, i) => i));
  assert.deepEqual(shuffledOrder(200), a);
  assert.notDeepEqual(a.slice(0, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("pregunta del día: no se repite en 200 días seguidos y vuelve a empezar", () => {
  const seen = new Set<number>();
  const start = Date.UTC(2026, 9, 24);
  for (let d = 0; d < 200; d += 1) {
    const key = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
    seen.add(questionIndexForDay(key, 200));
  }
  assert.equal(seen.size, 200);
  const first = new Date(start).toISOString().slice(0, 10);
  const again = new Date(start + 200 * 86_400_000).toISOString().slice(0, 10);
  assert.equal(questionIndexForDay(again, 200), questionIndexForDay(first, 200));
  assert.equal(dayNumber("2026-01-01"), 0);
});

test("otra pregunta: nunca la misma", () => {
  for (const r of [0, 0.3, 0.999]) assert.notEqual(randomOtherIndex(5, 200, () => r), 5);
  assert.equal(randomOtherIndex(0, 1), 0);
});

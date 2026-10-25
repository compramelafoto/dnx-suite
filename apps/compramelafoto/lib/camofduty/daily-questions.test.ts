import assert from "node:assert/strict";
import { test } from "node:test";
import { DAILY_QUESTIONS } from "./daily-questions";

test("preguntas del día: 200, numeradas, con cuatro opciones y una correcta", () => {
  assert.equal(DAILY_QUESTIONS.length, 200);
  DAILY_QUESTIONS.forEach((q, i) => {
    assert.equal(q.id, i + 1);
    assert.equal(q.options.length, 4, `#${q.id}`);
    assert.ok(q.correct >= 0 && q.correct <= 3, `#${q.id}`);
    assert.equal(new Set(q.options).size, 4, `#${q.id} opciones repetidas`);
    assert.ok(q.question.trim().length > 10 && q.explanation.trim().length > 10, `#${q.id}`);
  });
  // La correcta no cae siempre en el mismo lugar.
  for (const pos of [0, 1, 2, 3]) assert.ok(DAILY_QUESTIONS.filter((q) => q.correct === pos).length >= 30);
});

test("preguntas del día: nunca 'velocidad' para el obturador ni para el flash", () => {
  const forbidden = /velocidad(es)?\s+(de\s+)?(exposici|obturaci|del obturador|sincronizaci|lenta|rápida|alta|baja)/i;
  for (const q of DAILY_QUESTIONS) {
    for (const text of [q.question, q.explanation, ...q.options]) {
      assert.ok(!forbidden.test(text), `#${q.id}: «${text}»`);
    }
  }
});

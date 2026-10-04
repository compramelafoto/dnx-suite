/**
 * Un tipo de correo sin plantilla se encola y nunca se manda.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TRANSACTIONAL_EMAIL_TEMPLATES } from "./outbox";

test("el correo de verificación tiene plantilla y pide el enlace", () => {
  const t = TRANSACTIONAL_EMAIL_TEMPLATES.JUDGE_SIGNUP_VERIFY_EMAIL;
  assert.ok(t);
  assert.ok(t.requiredVars.includes("verifyUrl"));
  assert.ok(t.subject.length > 0);
});

test("el correo de la revisión dice cómo salió", () => {
  const t = TRANSACTIONAL_EMAIL_TEMPLATES.JUDGE_DIRECTORY_REVIEWED;
  assert.ok(t);
  assert.ok(t.requiredVars.includes("resultado"));
});

test("el aviso de ficha pendiente lleva a la cola y dice de quién es", () => {
  const t = TRANSACTIONAL_EMAIL_TEMPLATES.JUDGE_SIGNUP_PENDING_REVIEW;
  assert.ok(t);
  assert.ok(t.requiredVars.includes("colaUrl"), "sin enlace, hay que buscar la cola a mano");
  assert.ok(t.requiredVars.includes("nombre"), "sin nombre, el aviso no dice de quién es");
});

test("ningún asunto de jurado nombra un estado de la base", () => {
  for (const kind of [
    "JUDGE_SIGNUP_VERIFY_EMAIL",
    "JUDGE_DIRECTORY_REVIEWED",
    "JUDGE_SIGNUP_PENDING_REVIEW",
  ] as const) {
    const s = TRANSACTIONAL_EMAIL_TEMPLATES[kind].subject;
    for (const palabra of ["PENDING", "APPROVED", "REJECTED", "PUBLIC_SIGNUP", "VERIFY_EMAIL"]) {
      assert.ok(!s.includes(palabra), `${kind} no debe nombrar ${palabra}`);
    }
  }
});

test("toda plantilla declarada tiene asunto y variables", () => {
  for (const [kind, t] of Object.entries(TRANSACTIONAL_EMAIL_TEMPLATES)) {
    assert.ok(t.subject.trim().length > 0, `${kind} sin asunto`);
    assert.ok(Array.isArray(t.requiredVars), `${kind} sin variables`);
  }
});

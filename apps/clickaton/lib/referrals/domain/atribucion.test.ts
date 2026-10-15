import assert from "node:assert/strict";
import test from "node:test";

import { evaluarAtribucion } from "./atribucion";

const BASE = {
  codigoEncontrado: true,
  codigoActivo: true,
  referidorUserId: 10,
  referidoUserId: 20,
  referidoEmail: "ana@ejemplo.com",
  referidorEmail: "juan@ejemplo.com",
  yaTieneAtribucion: false,
};

test("el caso feliz: alguien trae a un colega nuevo que pagó", () => {
  assert.deepEqual(evaluarAtribucion(BASE), { ok: true, outcome: "CREATED" });
});

test("un código que no existe no rompe nada, sólo no atribuye", () => {
  const r = evaluarAtribucion({ ...BASE, codigoEncontrado: false, referidorUserId: null });
  assert.deepEqual(r, { ok: false, outcome: "CODE_NOT_FOUND" });
});

test("un código desactivado no atribuye", () => {
  const r = evaluarAtribucion({ ...BASE, codigoActivo: false });
  assert.deepEqual(r, { ok: false, outcome: "CODE_INACTIVE" });
});

test("nadie se refiere a sí mismo", () => {
  const r = evaluarAtribucion({ ...BASE, referidoUserId: 10 });
  assert.deepEqual(r, { ok: false, outcome: "SELF_REFERRAL" });
});

test("tampoco con otra cuenta y el mismo email", () => {
  const r = evaluarAtribucion({ ...BASE, referidoEmail: "juan@ejemplo.com" });
  assert.deepEqual(r, { ok: false, outcome: "SAME_EMAIL" });
});

test("el mismo email con distinta capitalización o espacios sigue siendo el mismo", () => {
  const r = evaluarAtribucion({ ...BASE, referidoEmail: "  JUAN@Ejemplo.com " });
  assert.deepEqual(r, { ok: false, outcome: "SAME_EMAIL" });
});

test("cada persona cuenta una sola vez en su vida", () => {
  // Si el invitado vuelve solo a la 3ª edición, ese mérito ya se cobró.
  const r = evaluarAtribucion({ ...BASE, yaTieneAtribucion: true });
  assert.deepEqual(r, { ok: false, outcome: "ALREADY_ATTRIBUTED" });
});

test("no hace falta haber participado para invitar", () => {
  // El invitado tiene que pagar para contar, así que nadie se fabrica un
  // beneficio: quien trae cinco personas que pagan se gana su Clickatón,
  // haya venido antes o no.
  assert.deepEqual(evaluarAtribucion(BASE), { ok: true, outcome: "CREATED" });
});

test("sin usuario del referido no se puede atribuir", () => {
  const r = evaluarAtribucion({ ...BASE, referidoUserId: null });
  assert.deepEqual(r, { ok: false, outcome: "ERROR" });
});

test("la autorreferencia se detecta antes que cualquier otra cosa", () => {
  // El motivo registrado debe ser el más específico, para que la auditoría
  // distinga un intento de fraude de un código simplemente inválido.
  const r = evaluarAtribucion({ ...BASE, referidoUserId: 10, referidoEmail: null });
  assert.equal(r.outcome, "SELF_REFERRAL");
});

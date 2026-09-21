/**
 * La verificación del correo reutiliza EmailVerificationToken, la tabla que ya
 * existe en las cinco bases y que CLF usa desde hace meses. Acá sólo vive la
 * decisión de si un token sirve, que es lo que se puede probar sin base.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  hashDeToken,
  crearTokenDeVerificacion,
  revisarToken,
  VERIFICACION_VIGENCIA_HORAS,
} from "./judgeEmailVerification";

const AHORA = new Date("2026-09-20T12:00:00.000Z");

test("el token viaja en claro y en la base queda su hash", () => {
  const t = crearTokenDeVerificacion(AHORA);
  assert.ok(t.token.length >= 32);
  assert.notEqual(t.token, t.tokenHash);
  assert.equal(t.tokenHash, hashDeToken(t.token));
});

test("el hash es el mismo que usa el resto de la suite (sha256 hex)", () => {
  assert.equal(
    hashDeToken("hola"),
    "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79",
  );
});

test("vence a las 48 horas", () => {
  const t = crearTokenDeVerificacion(AHORA);
  assert.equal(
    t.expiresAt.getTime() - AHORA.getTime(),
    VERIFICACION_VIGENCIA_HORAS * 60 * 60 * 1000,
  );
});

test("dos tokens seguidos no son iguales", () => {
  assert.notEqual(crearTokenDeVerificacion(AHORA).token, crearTokenDeVerificacion(AHORA).token);
});

test("un token vigente y sin usar sirve", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-22T12:00:00.000Z"), purpose: "VERIFY_EMAIL" },
    ahora: AHORA,
  });
  assert.deepEqual(r, { ok: true });
});

test("un token que no existe no sirve", () => {
  const r = revisarToken({ fila: null, ahora: AHORA });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "NO_EXISTE");
});

test("un token ya usado no sirve dos veces", () => {
  const r = revisarToken({
    fila: { usedAt: AHORA, expiresAt: new Date("2026-09-22T12:00:00.000Z"), purpose: "VERIFY_EMAIL" },
    ahora: AHORA,
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "YA_USADO");
});

test("un token vencido no sirve", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-19T12:00:00.000Z"), purpose: "VERIFY_EMAIL" },
    ahora: AHORA,
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "VENCIDO");
});

test("un token de otro propósito no sirve para verificar el correo", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-22T12:00:00.000Z"), purpose: "CREATE_ACCOUNT" },
    ahora: AHORA,
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "OTRO_PROPOSITO");
});

test("ningún mensaje de error nombra la base ni el token", () => {
  for (const fila of [
    null,
    { usedAt: AHORA, expiresAt: new Date("2026-09-22T12:00:00.000Z"), purpose: "VERIFY_EMAIL" as const },
    { usedAt: null, expiresAt: new Date("2026-09-19T12:00:00.000Z"), purpose: "VERIFY_EMAIL" as const },
  ]) {
    const r = revisarToken({ fila, ahora: AHORA });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && !/token|hash|null|VERIFY_EMAIL/i.test(r.mensaje), `mensaje técnico: ${!r.ok && r.mensaje}`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  signRegistrationAccessToken,
  verifyRegistrationAccessToken,
} from "./access-token";

const SECRETO = "secreto-de-prueba-para-los-tokens-de-acceso";
const BASE = {
  registrationId: "reg_1",
  editionSlug: "clickaton-2026",
};
const EN_UNA_HORA = Date.now() + 60 * 60_000;

test("un token de prueba técnica se verifica con su propio propósito", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA, purpose: "readiness" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "readiness" },
    SECRETO,
  );
  assert.equal(r.ok, true);
});

test("un token de resumen NO abre la prueba técnica", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA, purpose: "summary" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "readiness" },
    SECRETO,
  );
  assert.equal(r.ok, false, "un enlace filtrado de una pantalla no abre la otra");
});

test("un token de prueba técnica NO abre el resumen", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA, purpose: "readiness" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "summary" },
    SECRETO,
  );
  assert.equal(r.ok, false);
});

test("sin propósito explícito se sigue verificando como resumen", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken({ ...BASE, token }, SECRETO);
  assert.equal(r.ok, true, "los enlaces ya emitidos no se invalidan");
});

test("un token vencido no sirve aunque el propósito coincida", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: Date.now() - 1000, purpose: "readiness" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "readiness" },
    SECRETO,
  );
  assert.equal(r.ok, false);
});

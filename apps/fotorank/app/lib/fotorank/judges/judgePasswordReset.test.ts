import test from "node:test";
import assert from "node:assert/strict";

import {
  puedeRecibirEnlaceDeReset,
  revisarNuevaClave,
  RESET_VIGENCIA_HORAS,
  RESPUESTA_NEUTRA,
} from "./judgePasswordReset";
import { PASSWORD_MINIMA } from "./publicSignupForm";
import {
  crearTokenDeVerificacion,
  revisarToken,
  VERIFICACION_VIGENCIA_HORAS,
} from "./judgeEmailVerification";

const AHORA = new Date("2026-09-22T12:00:00Z");

test("una contraseña válida y repetida bien pasa", () => {
  const r = revisarNuevaClave({ password: "unaclavelarga", passwordConfirm: "unaclavelarga" });
  assert.equal(r.ok, true);
});

test("una contraseña corta no pasa y lo dice con el número", () => {
  const r = revisarNuevaClave({ password: "corta", passwordConfirm: "corta" });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores.password?.includes(String(PASSWORD_MINIMA)));
});

test("sin contraseña, se pide una", () => {
  const r = revisarNuevaClave({ password: "", passwordConfirm: "" });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores.password);
});

test("si la repetición no coincide, se avisa en el segundo campo", () => {
  const r = revisarNuevaClave({ password: "unaclavelarga", passwordConfirm: "otraclavelarga" });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores.passwordConfirm);
  assert.ok(!r.ok && !r.errores.password, "la primera está bien: el error va en la repetición");
});

test("una contraseña corta no reclama además que no coincide", () => {
  const r = revisarNuevaClave({ password: "abc", passwordConfirm: "xyz" });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores.password);
  assert.ok(
    !r.ok && !r.errores.passwordConfirm,
    "dos errores a la vez para un solo problema confunden",
  );
});

test("el enlace de reset vive mucho menos que el de confirmar el correo", () => {
  assert.ok(
    RESET_VIGENCIA_HORAS < VERIFICACION_VIGENCIA_HORAS,
    "una llave que cambia la contraseña no puede durar lo mismo que una confirmación",
  );
});

test("una cuenta activa o invitada puede recibir el enlace", () => {
  assert.equal(puedeRecibirEnlaceDeReset({ accountStatus: "ACTIVE" }), true);
  assert.equal(puedeRecibirEnlaceDeReset({ accountStatus: "INVITED" }), true);
});

test("una cuenta suspendida o dada de baja no lo recibe", () => {
  assert.equal(puedeRecibirEnlaceDeReset({ accountStatus: "SUSPENDED" }), false);
  assert.equal(puedeRecibirEnlaceDeReset({ accountStatus: "DISABLED" }), false);
});

test("sin cuenta no hay enlace", () => {
  assert.equal(puedeRecibirEnlaceDeReset(null), false);
});

test("la respuesta al pedir el enlace no revela si la cuenta existe", () => {
  for (const palabra of ["no existe", "no encontramos", "no hay", "inexistente"]) {
    assert.ok(
      !RESPUESTA_NEUTRA.toLowerCase().includes(palabra),
      `la respuesta no debería decir "${palabra}"`,
    );
  }
});

test("un token de confirmar correo NO sirve para cambiar la contraseña", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-24T12:00:00Z"), purpose: "VERIFY_EMAIL" },
    ahora: AHORA,
    esperado: "PASSWORD_RESET",
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.motivo === "OTRO_PROPOSITO");
});

test("un token de reset NO sirve para confirmar el correo", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-24T12:00:00Z"), purpose: "PASSWORD_RESET" },
    ahora: AHORA,
    esperado: "VERIFY_EMAIL",
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.motivo === "OTRO_PROPOSITO");
});

test("un token de reset vigente sirve para cambiar la contraseña", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-22T13:00:00Z"), purpose: "PASSWORD_RESET" },
    ahora: AHORA,
    esperado: "PASSWORD_RESET",
  });
  assert.equal(r.ok, true);
});

test("el token de reset caduca a las dos horas", () => {
  const creado = crearTokenDeVerificacion(AHORA, RESET_VIGENCIA_HORAS);
  const dosHorasDespues = new Date(AHORA.getTime() + RESET_VIGENCIA_HORAS * 60 * 60 * 1000);
  assert.equal(creado.expiresAt.getTime(), dosHorasDespues.getTime());
});

test("un token de reset vencido no sirve", () => {
  const r = revisarToken({
    fila: { usedAt: null, expiresAt: new Date("2026-09-22T11:59:00Z"), purpose: "PASSWORD_RESET" },
    ahora: AHORA,
    esperado: "PASSWORD_RESET",
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.motivo === "VENCIDO");
});

test("un token de reset ya usado no sirve dos veces", () => {
  const r = revisarToken({
    fila: {
      usedAt: new Date("2026-09-22T11:00:00Z"),
      expiresAt: new Date("2026-09-22T13:00:00Z"),
      purpose: "PASSWORD_RESET",
    },
    ahora: AHORA,
    esperado: "PASSWORD_RESET",
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.motivo === "YA_USADO");
});

test("ningún mensaje del reset nombra la base ni el token", () => {
  const filas = [
    null,
    { usedAt: new Date("2026-09-22T11:00:00Z"), expiresAt: new Date("2026-09-22T13:00:00Z"), purpose: "PASSWORD_RESET" as const },
    { usedAt: null, expiresAt: new Date("2026-09-22T11:00:00Z"), purpose: "PASSWORD_RESET" as const },
    { usedAt: null, expiresAt: new Date("2026-09-22T13:00:00Z"), purpose: "VERIFY_EMAIL" as const },
  ];
  for (const fila of filas) {
    const r = revisarToken({ fila, ahora: AHORA, esperado: "PASSWORD_RESET" });
    if (r.ok) continue;
    assert.ok(
      !/token|hash|PASSWORD_RESET|VERIFY_EMAIL|null/i.test(r.mensaje),
      `mensaje técnico: ${r.mensaje}`,
    );
  }
});

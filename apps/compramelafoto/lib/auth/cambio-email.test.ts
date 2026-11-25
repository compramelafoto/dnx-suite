import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codificarCambioEmail,
  decodificarCambioEmail,
  prefijoCambioEmailDeUsuario,
} from "./cambio-email";

test("ida y vuelta del pedido de cambio de email", () => {
  const v = codificarCambioEmail(62, "nueva@ejemplo.com");
  assert.ok(v.startsWith(prefijoCambioEmailDeUsuario(62)));
  assert.deepEqual(decodificarCambioEmail(v), { userId: 62, emailNuevo: "nueva@ejemplo.com" });
});

test("un email común (token de alta) no se toma como cambio", () => {
  assert.equal(decodificarCambioEmail("persona@ejemplo.com"), null);
});

test("valores rotos no se aceptan", () => {
  assert.equal(decodificarCambioEmail("cambio-email:abc:x@y.com"), null);
  assert.equal(decodificarCambioEmail("cambio-email:5:sinarroba"), null);
  assert.equal(decodificarCambioEmail("cambio-email::x@y.com"), null);
});

test("el prefijo de un usuario no abarca a otro con más dígitos", () => {
  const v = codificarCambioEmail(620, "a@b.com");
  assert.equal(v.startsWith(prefijoCambioEmailDeUsuario(62)), false);
});

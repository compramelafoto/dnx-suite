import { test } from "node:test";
import assert from "node:assert/strict";

import { avisoDeReferido } from "./avisoDeReferido";

const usuario = { id: 42, email: "ana@ejemplo.com", name: "Ana Pérez" };

test("sin cookie no hay aviso", () => {
  assert.equal(avisoDeReferido(undefined, usuario), null);
  assert.equal(avisoDeReferido(null, usuario), null);
  assert.equal(avisoDeReferido("", usuario), null);
});

test("un código inválido no genera aviso", () => {
  assert.equal(avisoDeReferido("a b<script>", usuario), null);
  assert.equal(avisoDeReferido("ab", usuario), null);
});

test("un código válido arma el aviso de fotorank, normalizado", () => {
  assert.deepEqual(avisoDeReferido("  dani123 ", usuario), {
    platform: "fotorank",
    code: "DANI123",
    externalUserId: 42,
    email: "ana@ejemplo.com",
    name: "Ana Pérez",
  });
});

test("sin nombre manda null y sin email no avisa", () => {
  assert.equal(avisoDeReferido("DANI123", { id: 1, email: "x@y.com" })?.name, null);
  assert.equal(avisoDeReferido("DANI123", { id: 1, email: "  " }), null);
});

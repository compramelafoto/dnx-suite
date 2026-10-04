/**
 * avatarUrl pasó a guardar la clave del bucket. La pantalla nunca arma esa
 * ruta a mano: si lo hiciera, cada lugar la armaría distinto.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { judgeAvatarSrc } from "./judgeAvatarSrc";

test("una clave del bucket se sirve por la ruta propia", () => {
  assert.equal(
    judgeAvatarSrc({ id: "perfil1", avatarUrl: "fotorank/judges/cuenta1/avatar/abc123.jpg" }),
    "/api/jurados/avatar/perfil1/abc123.jpg",
  );
});

test("sin foto devuelve null", () => {
  assert.equal(judgeAvatarSrc({ id: "perfil1", avatarUrl: null }), null);
  assert.equal(judgeAvatarSrc({ id: "perfil1", avatarUrl: "   " }), null);
});

test("una URL externa se respeta tal cual", () => {
  assert.equal(
    judgeAvatarSrc({ id: "perfil1", avatarUrl: "https://ejemplo.com/foto.jpg" }),
    "https://ejemplo.com/foto.jpg",
  );
});

test("una clave que no es de avatar de jurado no se sirve", () => {
  assert.equal(judgeAvatarSrc({ id: "perfil1", avatarUrl: "fotorank/entries/x/original.jpg" }), null);
});

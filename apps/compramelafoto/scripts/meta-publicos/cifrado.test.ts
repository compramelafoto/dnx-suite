import { test } from "node:test";
import assert from "node:assert/strict";
import { armarCsv, cifrarLista, normalizarCorreo, sha256 } from "./cifrado";

test("normaliza espacios y mayúsculas sin tocar puntos ni +etiquetas", () => {
  assert.equal(normalizarCorreo("  Juan.Perez+fotos@Gmail.COM "), "juan.perez+fotos@gmail.com");
});

test("descarta vacíos, inválidos y dominios mal tipeados", () => {
  assert.equal(normalizarCorreo(""), null);
  assert.equal(normalizarCorreo(null), null);
  assert.equal(normalizarCorreo("sin-arroba.com"), null);
  assert.equal(normalizarCorreo("ana@gmail.con"), null);
});

test("sha256 coincide con el valor de referencia", () => {
  // echo -n "test@example.com" | shasum -a 256
  assert.equal(sha256("test@example.com"), "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
});

test("cifrarLista quita duplicados y nunca deja texto plano", () => {
  const salida = cifrarLista(["A@b.com", "a@b.com ", "malo", null]);
  assert.equal(salida.length, 1);
  assert.match(salida[0], /^[0-9a-f]{64}$/);
  assert.ok(!salida.join().includes("@"));
});

test("el CSV lleva encabezado de Meta y país cifrado", () => {
  const csv = armarCsv([sha256("a@b.com")]);
  const [encabezado, fila] = csv.trim().split("\n");
  assert.equal(encabezado, "email,country");
  assert.equal(fila.split(",")[1], sha256("ar"));
  assert.ok(!csv.includes("@"));
});

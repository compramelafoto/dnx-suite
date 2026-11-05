import { test } from "node:test";
import assert from "node:assert/strict";
import { currencyForNewAlbum } from "./album-currency";

test("apagado: siempre ARS", () => {
  assert.equal(currencyForNewAlbum(null, false), "ARS");
  assert.equal(currencyForNewAlbum("MX", false), "ARS");
});
test("encendido: moneda del país del dueño", () => {
  assert.equal(currencyForNewAlbum("MX", true), "MXN");
  assert.equal(currencyForNewAlbum("AR", true), "ARS");
  assert.equal(currencyForNewAlbum(null, true), "ARS");
});

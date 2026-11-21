import assert from "node:assert/strict";
import { test } from "node:test";
import { codigoDeCanje } from "../school-fulfillment/codigo-de-canje";
import { codigoDeEntregaDePedido, hashDeToken, leerCodigoDeEntregaDePedido, nuevoTokenDeLote } from "./codigos";

const SECRETO = "secreto-de-prueba";

test("ida y vuelta del código de entrega devuelve el id", () => {
  const c = codigoDeEntregaDePedido(4801, SECRETO);
  assert.match(c, /^p4801\.[A-Za-z0-9_-]{20}$/);
  assert.equal(leerCodigoDeEntregaDePedido(c, SECRETO), 4801);
});

test("firma alterada o secreto distinto da null", () => {
  const c = codigoDeEntregaDePedido(10, SECRETO);
  const alterado = c.slice(0, -1) + (c.endsWith("a") ? "b" : "a");
  assert.equal(leerCodigoDeEntregaDePedido(alterado, SECRETO), null);
  assert.equal(leerCodigoDeEntregaDePedido(c, "otro"), null);
});

test("un código de canje válido no se acepta como entrega de pedido", () => {
  const canje = codigoDeCanje(123, SECRETO);
  assert.equal(leerCodigoDeEntregaDePedido(canje, SECRETO), null);
  const reetiquetado = "p" + canje.slice(1);
  assert.equal(leerCodigoDeEntregaDePedido(reetiquetado, SECRETO), null);
});

test("ids no positivos o basura dan null", () => {
  assert.equal(leerCodigoDeEntregaDePedido("p0.x", SECRETO), null);
  assert.equal(leerCodigoDeEntregaDePedido("p-1.x", SECRETO), null);
  assert.equal(leerCodigoDeEntregaDePedido("", SECRETO), null);
});

test("el hash del token coincide y dos tokens son distintos", () => {
  const a = nuevoTokenDeLote();
  const b = nuevoTokenDeLote();
  assert.equal(hashDeToken(a.token), a.hash);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(hashDeToken("inventado"), a.hash);
});

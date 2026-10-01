/**
 * Un directorio abierto sin freno se llena de basura en una tarde.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  puedeAltaDesdeIp,
  registrarAltaDesdeIp,
  limpiarAltasParaPruebas,
  ipDelPedido,
  ALTAS_MAXIMAS_POR_IP_POR_DIA,
} from "./signupRateLimit";

const AHORA = new Date("2026-09-20T12:00:00.000Z");

test("las primeras altas pasan y la que sobra no", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA; i++) {
    assert.equal(puedeAltaDesdeIp("1.2.3.4", AHORA), true, `el alta ${i + 1} debería pasar`);
    registrarAltaDesdeIp("1.2.3.4", AHORA);
  }
  assert.equal(puedeAltaDesdeIp("1.2.3.4", AHORA), false);
});

test("otra IP no hereda el freno", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA; i++) registrarAltaDesdeIp("1.2.3.4", AHORA);
  assert.equal(puedeAltaDesdeIp("5.6.7.8", AHORA), true);
});

test("al día siguiente vuelve a poder", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA; i++) registrarAltaDesdeIp("1.2.3.4", AHORA);
  const manana = new Date(AHORA.getTime() + 24 * 60 * 60 * 1000 + 1);
  assert.equal(puedeAltaDesdeIp("1.2.3.4", manana), true);
});

test("sin IP conocida no se frena a nadie: mejor dejar pasar que bloquear a todos juntos", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA + 3; i++) {
    assert.equal(puedeAltaDesdeIp("", AHORA), true);
    registrarAltaDesdeIp("", AHORA);
  }
});

test("de x-forwarded-for se toma la primera, que es la del visitante", () => {
  assert.equal(ipDelPedido(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" })), "1.2.3.4");
  assert.equal(ipDelPedido(new Headers({ "x-forwarded-for": "  9.9.9.9  " })), "9.9.9.9");
  assert.equal(ipDelPedido(new Headers({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  assert.equal(ipDelPedido(new Headers()), "");
});

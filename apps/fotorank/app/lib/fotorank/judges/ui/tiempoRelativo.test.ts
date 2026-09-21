/**
 * "Último acceso: 19/9/2026, 14:32:07" obliga a hacer la cuenta mentalmente.
 * La fecha exacta queda en el title, para cuando de verdad hace falta.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { tiempoRelativo, fechaExacta } from "./tiempoRelativo";

const AHORA = new Date("2026-09-20T12:00:00.000Z");
const minutos = (n: number) => new Date(AHORA.getTime() - n * 60_000);
const horas = (n: number) => new Date(AHORA.getTime() - n * 3_600_000);
const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);

test("sin fecha, lo dice sin asustar", () => {
  assert.equal(tiempoRelativo(null, AHORA), "sin actividad");
});

test("hace instantes", () => {
  assert.equal(tiempoRelativo(minutos(0), AHORA), "recién");
  assert.equal(tiempoRelativo(minutos(1), AHORA), "hace 1 minuto");
  assert.equal(tiempoRelativo(minutos(5), AHORA), "hace 5 minutos");
});

test("horas, en singular y plural", () => {
  assert.equal(tiempoRelativo(horas(1), AHORA), "hace 1 hora");
  assert.equal(tiempoRelativo(horas(3), AHORA), "hace 3 horas");
});

test("el castellano tiene palabras propias y se usan", () => {
  // "ayer" y "anteayer" se entienden mejor que "hace 1 día" y "hace 2 días".
  assert.equal(tiempoRelativo(dias(1), AHORA), "ayer");
  assert.equal(tiempoRelativo(dias(2), AHORA), "anteayer");
  assert.equal(tiempoRelativo(dias(3), AHORA), "hace 3 días");
});

test("pasado el mes, meses; pasado el año, años", () => {
  assert.equal(tiempoRelativo(dias(45), AHORA), "el mes pasado"); // mes y medio no es "hace 2 meses"
  assert.equal(tiempoRelativo(dias(200), AHORA), "hace 6 meses");
  assert.equal(tiempoRelativo(dias(400), AHORA), "el año pasado");
  assert.equal(tiempoRelativo(dias(800), AHORA), "hace 2 años");
});

test("una fecha futura no dice 'hace'", () => {
  const manana = new Date(AHORA.getTime() + 86_400_000);
  assert.equal(tiempoRelativo(manana, AHORA), "mañana");
  const enTresHoras = new Date(AHORA.getTime() + 3 * 3_600_000);
  assert.equal(tiempoRelativo(enTresHoras, AHORA), "dentro de 3 horas");
});

test("ningún texto trae la hora con segundos", () => {
  for (const f of [minutos(3), horas(5), dias(2), dias(100)]) {
    assert.ok(!/\d{1,2}:\d{2}:\d{2}/.test(tiempoRelativo(f, AHORA)));
  }
});

test("la fecha exacta queda disponible para el title", () => {
  const texto = fechaExacta(new Date("2026-09-19T17:32:07.000Z"));
  assert.ok(texto.includes("2026"));
  assert.equal(fechaExacta(null), "");
});

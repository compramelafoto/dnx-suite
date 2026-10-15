import assert from "node:assert/strict";
import test from "node:test";

import { fechaAr, fechaHoraAr, formatearEnAr, horaAr, zonaSegura, ZONA_ARGENTINA } from "./fecha-ar";

/**
 * Los tests corren con el TZ que tenga la máquina. Para probar lo que importa
 * —que el huso del runtime no manda— hay que mirarlos con TZ=UTC, que es el de
 * Vercel. `pnpm test:fecha-ar` lo fija.
 */

test("una inscripción de las 23:07 no se muestra al día siguiente", () => {
  // El caso real: 21/09/2026 23:07 en Argentina, guardado como 02:07 UTC del 22.
  const creada = new Date("2026-09-22T02:07:00.000Z");
  assert.equal(fechaHoraAr(creada), "21/9/26, 23:07");
});

test("la fecha sola y la hora sola también son argentinas", () => {
  const instante = new Date("2026-09-22T02:07:00.000Z");
  assert.equal(fechaAr(instante), "21/09/2026");
  assert.equal(horaAr(instante), "23:07");
});

test("acepta ISO y milisegundos, no sólo Date", () => {
  assert.equal(fechaHoraAr("2026-09-22T02:07:00.000Z"), "21/9/26, 23:07");
  assert.equal(fechaHoraAr(Date.parse("2026-09-22T02:07:00.000Z")), "21/9/26, 23:07");
});

test("sin valor o con valor inválido devuelve el guion", () => {
  assert.equal(fechaHoraAr(null), "—");
  assert.equal(fechaHoraAr(undefined), "—");
  assert.equal(fechaHoraAr(""), "—");
  assert.equal(fechaHoraAr("no es una fecha"), "—");
  assert.equal(fechaHoraAr(new Date("invalida")), "—");
  assert.equal(fechaHoraAr(null, null, "Todavía no"), "Todavía no");
});

test("la zona de la edición manda cuando está cargada", () => {
  const instante = new Date("2026-07-15T12:00:00.000Z");
  assert.equal(horaAr(instante, "Europe/Madrid"), "14:00");
  assert.equal(horaAr(instante), "09:00");
});

test("una zona mal escrita se cae a Argentina en vez de romper la pantalla", () => {
  assert.equal(zonaSegura("Tierra/Media"), ZONA_ARGENTINA);
  assert.equal(zonaSegura(""), ZONA_ARGENTINA);
  assert.equal(zonaSegura(null), ZONA_ARGENTINA);
  assert.equal(zonaSegura("Europe/Madrid"), "Europe/Madrid");
  assert.equal(horaAr(new Date("2026-07-15T12:00:00.000Z"), "Tierra/Media"), "09:00");
});

test("formatearEnAr fuerza la zona aunque le pasen opciones propias", () => {
  const instante = new Date("2026-12-13T02:30:00.000Z");
  assert.equal(
    formatearEnAr(instante, { weekday: "long", day: "numeric", month: "long" }),
    "sábado, 12 de diciembre",
  );
});

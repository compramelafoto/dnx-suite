import assert from "node:assert/strict";
import test from "node:test";

import {
  ESCALERA_REFERIDOS,
  colegasParaElSiguienteEscalon,
  descuentoPorColegas,
  siguienteEscalon,
} from "./escalera";

test("sin colegas traídos no hay descuento", () => {
  assert.equal(descuentoPorColegas(0), 0);
});

test("la escalera acordada: 1→10%, 2→20%, 3→35%, 4→60%, 5→gratis", () => {
  assert.equal(descuentoPorColegas(1), 10);
  assert.equal(descuentoPorColegas(2), 20);
  assert.equal(descuentoPorColegas(3), 35);
  assert.equal(descuentoPorColegas(4), 60);
  assert.equal(descuentoPorColegas(5), 100);
});

test("traer más de 5 no supera el 100%: nadie cobra por inscribirse", () => {
  assert.equal(descuentoPorColegas(6), 100);
  assert.equal(descuentoPorColegas(50), 100);
});

test("un contador inválido se trata como cero, nunca como un regalo", () => {
  assert.equal(descuentoPorColegas(-1), 0);
  assert.equal(descuentoPorColegas(1.5), 10, "se redondea hacia abajo");
  assert.equal(descuentoPorColegas(Number.NaN), 0);
});

test("el siguiente escalón guía a quien todavía no llegó", () => {
  assert.deepEqual(siguienteEscalon(0), { colegas: 1, descuento: 10 });
  assert.deepEqual(siguienteEscalon(2), { colegas: 3, descuento: 35 });
  assert.deepEqual(siguienteEscalon(4), { colegas: 5, descuento: 100 });
});

test("quien llegó al tope no tiene siguiente escalón", () => {
  assert.equal(siguienteEscalon(5), null);
  assert.equal(siguienteEscalon(9), null);
});

test("cuántos colegas faltan para el siguiente escalón", () => {
  assert.equal(colegasParaElSiguienteEscalon(0), 1);
  assert.equal(colegasParaElSiguienteEscalon(4), 1);
  assert.equal(colegasParaElSiguienteEscalon(5), 0);
});

test("la escalera está ordenada y es creciente", () => {
  // Si alguien reordena la tabla, un escalón más alto con menos descuento
  // haría que convenga traer MENOS colegas.
  for (let i = 1; i < ESCALERA_REFERIDOS.length; i += 1) {
    assert.ok(
      ESCALERA_REFERIDOS[i]!.colegas > ESCALERA_REFERIDOS[i - 1]!.colegas,
      "los colegas deben crecer",
    );
    assert.ok(
      ESCALERA_REFERIDOS[i]!.descuento > ESCALERA_REFERIDOS[i - 1]!.descuento,
      "el descuento debe crecer",
    );
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { acumularDigito, ayudaDeTeclas, formaDeLaNota, notaPorTecla, textoDeLaNota } from "./formaDeLaNota";

test("cada escala tiene su forma", () => {
  assert.equal(formaDeLaNota({ min: 0, max: 1 }), "SI_NO");
  assert.equal(formaDeLaNota({ min: 1, max: 5 }), "BOTONES");
  assert.equal(formaDeLaNota({ min: 1, max: 10 }), "BOTONES");
  assert.equal(formaDeLaNota({ min: 0, max: 100 }), "CAMPO");
});

test("sí o no con S, N, 1 y 0", () => {
  const e = { min: 0, max: 1 };
  assert.equal(notaPorTecla(e, "s"), 1);
  assert.equal(notaPorTecla(e, "N"), 0);
  assert.equal(notaPorTecla(e, "1"), 1);
  assert.equal(notaPorTecla(e, "0"), 0);
  assert.equal(notaPorTecla(e, "7"), null);
  assert.equal(textoDeLaNota(e, 1), "Sí");
});

test("del 1 al 10 el 0 vale 10; del 1 al 5 no hay 0 ni 6", () => {
  assert.equal(notaPorTecla({ min: 1, max: 10 }, "0"), 10);
  assert.equal(notaPorTecla({ min: 1, max: 5 }, "0"), null);
  assert.equal(notaPorTecla({ min: 1, max: 5 }, "6"), null);
  assert.equal(notaPorTecla({ min: 1, max: 5 }, "4"), 4);
});

test("del 0 al 100 los dígitos seguidos forman el número", () => {
  const e = { min: 0, max: 100 };
  const a = acumularDigito(e, "", "7");
  const b = acumularDigito(e, a.texto, "5");
  assert.equal(b.valor, 75);
  assert.equal(acumularDigito(e, "75", "3").valor, 3, "si se pasa del máximo, empieza de nuevo");
  assert.equal(acumularDigito(e, "10", "0").valor, 100);
  assert.equal(ayudaDeTeclas(e), "escribí del 0 al 100");
});

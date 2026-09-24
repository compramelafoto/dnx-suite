import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPE_DE_FOTOS_POR_JURADO_POR_OMISION,
  juradosRecomendados,
} from "./juradosRecomendados";

test("270 obras con 3 miradas y tope de 200 dan 5 jurados", () => {
  const r = juradosRecomendados({ obras: 270, miradasPorObra: 3, topeDeFotosPorJurado: 200 });
  assert.ok(r);
  assert.equal(r.recomendados, 5);
});

test("el motivo muestra la cuenta, no una frase vacía", () => {
  const r = juradosRecomendados({ obras: 270, miradasPorObra: 3, topeDeFotosPorJurado: 200 })!;
  assert.match(r.motivo, /270/);
  assert.match(r.motivo, /810/);
  assert.match(r.motivo, /200/);
});

/** El piso de 3 no se negocia: con menos no hay mediana ni dispersión. */
test("nunca recomienda menos de tres", () => {
  const r = juradosRecomendados({ obras: 12, miradasPorObra: 3, topeDeFotosPorJurado: 200 })!;
  assert.equal(r.recomendados, 3);
});

test("con muchas obras el número crece", () => {
  const r = juradosRecomendados({ obras: 9000, miradasPorObra: 3, topeDeFotosPorJurado: 200 })!;
  assert.equal(r.recomendados, 135);
});

test("sin obras no hay nada que recomendar", () => {
  assert.equal(
    juradosRecomendados({ obras: 0, miradasPorObra: 3, topeDeFotosPorJurado: 200 }),
    null,
  );
});

test("un tope inválido cae en el de fábrica en vez de dividir por cero", () => {
  for (const topeDeFotosPorJurado of [0, -50, Number.NaN]) {
    const r = juradosRecomendados({ obras: 270, miradasPorObra: 3, topeDeFotosPorJurado })!;
    assert.equal(r.recomendados, 5, `tope ${topeDeFotosPorJurado}`);
  }
});

test("el tope de fábrica es 200", () => {
  assert.equal(TOPE_DE_FOTOS_POR_JURADO_POR_OMISION, 200);
});

test("una cantidad de miradas inválida no rompe la cuenta", () => {
  const r = juradosRecomendados({ obras: 270, miradasPorObra: 0, topeDeFotosPorJurado: 200 })!;
  assert.ok(r.recomendados >= 3);
});

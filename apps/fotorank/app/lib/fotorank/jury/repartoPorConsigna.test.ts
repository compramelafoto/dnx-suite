import test from "node:test";
import assert from "node:assert/strict";

import {
  cargaDelReparto,
  consignasDeLaVacante,
  consignasDelJurado,
  leTocaLaConsigna,
  repartoPorConsigna,
} from "./repartoPorConsigna";

const ONCE = Array.from({ length: 11 }, (_, i) => `consigna-${i + 1}`);
const CINCO = ["j1", "j2", "j3", "j4", "j5"];

test("cada consigna la juzgan tres jurados", () => {
  const reparto = repartoPorConsigna({ consignas: ONCE, jurados: CINCO, miradasPorObra: 3 });
  for (const consigna of ONCE) {
    const quienes = reparto.filter((r) => r.consignaId === consigna).map((r) => r.juradoId);
    assert.equal(quienes.length, 3, `${consigna} no tiene tres jurados`);
    assert.equal(new Set(quienes).size, 3, `${consigna} tiene un jurado repetido`);
  }
});

test("la carga queda pareja entre los jurados", () => {
  const reparto = repartoPorConsigna({ consignas: ONCE, jurados: CINCO, miradasPorObra: 3 });
  const porJurado = CINCO.map((j) => reparto.filter((r) => r.juradoId === j).length);
  const masCargado = Math.max(...porJurado);
  const menosCargado = Math.min(...porJurado);
  assert.ok(
    masCargado - menosCargado <= 1,
    `diferencia de ${masCargado - menosCargado} consignas entre el que más y el que menos`,
  );
});

test("con menos jurados que miradas, juzgan todos", () => {
  const reparto = repartoPorConsigna({
    consignas: ONCE,
    jurados: ["j1", "j2"],
    miradasPorObra: 3,
  });
  assert.equal(reparto.length, ONCE.length * 2);
  for (const consigna of ONCE) {
    assert.equal(reparto.filter((r) => r.consignaId === consigna).length, 2);
  }
});

/**
 * El mismo reparto todas las veces: si cambiara entre una pantalla y la
 * siguiente, un jurado vería aparecer y desaparecer consignas.
 */
test("el reparto no cambia entre corridas", () => {
  const a = repartoPorConsigna({ consignas: ONCE, jurados: CINCO, miradasPorObra: 3 });
  const b = repartoPorConsigna({ consignas: ONCE, jurados: CINCO, miradasPorObra: 3 });
  assert.deepEqual(a, b);
});

test("sin consignas o sin jurados no reparte nada", () => {
  assert.deepEqual(repartoPorConsigna({ consignas: [], jurados: CINCO, miradasPorObra: 3 }), []);
  assert.deepEqual(repartoPorConsigna({ consignas: ONCE, jurados: [], miradasPorObra: 3 }), []);
});

test("un solo jurado se queda con todo", () => {
  const reparto = repartoPorConsigna({ consignas: ONCE, jurados: ["j1"], miradasPorObra: 3 });
  assert.equal(reparto.length, 11);
  assert.ok(reparto.every((r) => r.juradoId === "j1"));
});

test("si las miradas igualan a los jurados, todos ven todo", () => {
  const reparto = repartoPorConsigna({ consignas: ONCE, jurados: CINCO, miradasPorObra: 5 });
  assert.equal(reparto.length, 11 * 5);
});

test("nadie recibe la misma consigna dos veces", () => {
  const reparto = repartoPorConsigna({ consignas: ONCE, jurados: CINCO, miradasPorObra: 3 });
  const pares = reparto.map((r) => `${r.juradoId}|${r.consignaId}`);
  assert.equal(new Set(pares).size, pares.length);
});

test("la cuenta dice cuántas fotos le tocan a cada uno", () => {
  const carga = cargaDelReparto({ obras: 270, consignas: 11, jurados: 5, miradasPorObra: 3 });
  assert.equal(carga.consignasPorJurado, 7);
  assert.equal(carga.fotosPorJurado, 162);
  assert.equal(carga.notasPorJurado, 648);
});

test("con tres jurados cada uno juzga todo", () => {
  const carga = cargaDelReparto({ obras: 270, consignas: 11, jurados: 3, miradasPorObra: 3 });
  assert.equal(carga.fotosPorJurado, 270);
});

test("sin jurados la cuenta no se rompe", () => {
  const carga = cargaDelReparto({ obras: 270, consignas: 11, jurados: 0, miradasPorObra: 3 });
  assert.equal(carga.fotosPorJurado, 0);
  assert.equal(carga.consignasPorJurado, 0);
  assert.equal(carga.notasPorJurado, 0);
});

test("sin reparto, el jurado ve todas las consignas", () => {
  const consignas = consignasDelJurado([{ promptExternalId: null }, { promptExternalId: null }]);
  assert.equal(consignas, null);
  assert.equal(leTocaLaConsigna(consignas, "consigna-7"), true);
  assert.equal(leTocaLaConsigna(consignas, null), true);
});

test("con reparto, sólo ve las suyas", () => {
  const consignas = consignasDelJurado([{ promptExternalId: "c1" }, { promptExternalId: "c2" }]);
  assert.equal(leTocaLaConsigna(consignas, "c1"), true);
  assert.equal(leTocaLaConsigna(consignas, "c3"), false);
});

/**
 * Si al jurado le repartieron consignas, una obra sin consigna no es suya:
 * dejarla pasar le mostraría obras que nadie le asignó.
 */
test("con reparto, una obra sin consigna no entra", () => {
  const consignas = consignasDelJurado([{ promptExternalId: "c1" }]);
  assert.equal(leTocaLaConsigna(consignas, null), false);
});

test("una asignación mixta cuenta como reparto", () => {
  const consignas = consignasDelJurado([{ promptExternalId: "c1" }, { promptExternalId: null }]);
  assert.ok(consignas);
  assert.equal(leTocaLaConsigna(consignas, "c1"), true);
  assert.equal(leTocaLaConsigna(consignas, "c9"), false);
});

test("sin asignaciones ve todo y no explota", () => {
  assert.equal(consignasDelJurado([]), null);
});

test("la vacante 1 recibe su tanda de consignas", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE,
    vacantes: 5,
    miradasPorObra: 3,
    seatNumber: 1,
  });
  assert.equal(suyas.size, 7);
  assert.ok(suyas.has("consigna-1"));
});

test("entre las cinco vacantes se cubren todas las consignas tres veces", () => {
  const cuenta = new Map<string, number>();
  for (let s = 1; s <= 5; s++) {
    for (const c of consignasDeLaVacante({
      consignas: ONCE,
      vacantes: 5,
      miradasPorObra: 3,
      seatNumber: s,
    })) {
      cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
  }
  assert.equal(cuenta.size, 11);
  for (const [consigna, veces] of cuenta) {
    assert.equal(veces, 3, `${consigna} la miran ${veces} jurados`);
  }
});

/**
 * La excepción se escribe cuando el organizador redistribuye el lote de una
 * vacante que nunca se llenó. Suma, no reemplaza: la vacante original sigue
 * teniendo esa consigna, aunque no haya nadie sentado ahí.
 */
test("una excepción agrega una consigna a otra vacante", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE,
    vacantes: 5,
    miradasPorObra: 3,
    seatNumber: 2,
    excepciones: [{ seatNumber: 2, promptExternalId: "consigna-9" }],
  });
  assert.ok(suyas.has("consigna-9"));
});

test("una excepción de otra vacante no se cuela", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE,
    vacantes: 5,
    miradasPorObra: 3,
    seatNumber: 2,
    excepciones: [{ seatNumber: 4, promptExternalId: "consigna-9" }],
  });
  assert.equal(suyas.has("consigna-9"), false);
});

test("una vacante fuera de rango no recibe nada", () => {
  for (const seatNumber of [0, 6, -1]) {
    assert.equal(
      consignasDeLaVacante({ consignas: ONCE, vacantes: 5, miradasPorObra: 3, seatNumber }).size,
      0,
      `vacante ${seatNumber}`,
    );
  }
});

test("sin vacantes declaradas no hay reparto que aplicar", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE,
    vacantes: 0,
    miradasPorObra: 3,
    seatNumber: 1,
  });
  assert.equal(suyas.size, 0);
});

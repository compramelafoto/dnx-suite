import test from "node:test";
import assert from "node:assert/strict";

import {
  armarVacantes,
  primeraVacanteLibre,
  repartirLoteHuerfano,
  sePuedeCambiarLaCantidad,
} from "./vacantes";

const CONSIGNAS = Array.from({ length: 11 }, (_, i) => ({
  id: `c${i + 1}`,
  sequence: i + 1,
  titulo: `Consigna ${i + 1}`,
}));

test("declarar cinco arma cinco vacantes numeradas", () => {
  const v = armarVacantes({
    plannedSeats: 5,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [],
  });
  assert.equal(v.length, 5);
  assert.deepEqual(
    v.map((x) => x.seatNumber),
    [1, 2, 3, 4, 5],
  );
});

/** El punto de todo esto: la vacante tiene su lote aunque no haya nadie. */
test("cada vacante trae sus consignas aunque esté vacía", () => {
  const v = armarVacantes({
    plannedSeats: 5,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [],
  });
  assert.ok(v[0]!.consignas.length > 0, "la vacante 1 quedó sin lote");
  assert.equal(v[0]!.judgeAccountId, null);
});

test("quien está sentado aparece en su vacante", () => {
  const v = armarVacantes({
    plannedSeats: 5,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: 2, judgeAccountId: "j-belen", nombre: "Belén" }],
  });
  assert.equal(v[1]!.judgeAccountId, "j-belen");
  assert.equal(v[1]!.nombre, "Belén");
  assert.equal(v[0]!.judgeAccountId, null);
});

/** Una asignación vieja, de antes del reparto, no puede desaparecer de la pantalla. */
test("un asignado sin vacante cae en la primera libre", () => {
  const v = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: null, judgeAccountId: "j-vieja", nombre: "Melisa" }],
  });
  assert.equal(v[0]!.judgeAccountId, "j-vieja");
});

test("el que tiene vacante no se la cede al que no tiene", () => {
  const v = armarVacantes({
    plannedSeats: 2,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [
      { seatNumber: null, judgeAccountId: "j-sin", nombre: "Sin vacante" },
      { seatNumber: 1, judgeAccountId: "j-con", nombre: "Con vacante" },
    ],
  });
  assert.equal(v[0]!.judgeAccountId, "j-con");
  assert.equal(v[1]!.judgeAccountId, "j-sin");
});

test("la primera libre es la primera sin nadie", () => {
  const v = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: 1, judgeAccountId: "j-1", nombre: null }],
  });
  assert.equal(primeraVacanteLibre(v), 2);
});

test("sin vacantes libres devuelve null", () => {
  const v = armarVacantes({
    plannedSeats: 1,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: 1, judgeAccountId: "j-1", nombre: null }],
  });
  assert.equal(primeraVacanteLibre(v), null);
});

test("declarar cero o menos no arma nada", () => {
  for (const plannedSeats of [0, -2]) {
    assert.deepEqual(
      armarVacantes({ plannedSeats, consignas: CONSIGNAS, miradasPorObra: 3, ocupantes: [] }),
      [],
    );
  }
});

test("no se cambia la cantidad si ya hay evaluaciones enviadas", () => {
  const r = sePuedeCambiarLaCantidad({ evaluacionesEnviadas: 12 });
  assert.equal(r.ok, false);
  assert.match(r.motivo!, /calific/i);
});

test("sin evaluaciones enviadas se puede cambiar", () => {
  assert.deepEqual(sePuedeCambiarLaCantidad({ evaluacionesEnviadas: 0 }), { ok: true });
});

/* ---------- el lote huérfano ---------- */

function conDosOcupadas() {
  return armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [
      { seatNumber: 1, judgeAccountId: "j1", nombre: "Uno" },
      { seatNumber: 2, judgeAccountId: "j2", nombre: "Dos" },
    ],
  });
}

test("el lote de la vacante vacía se reparte entre las ocupadas", () => {
  const nuevas = repartirLoteHuerfano({ vacantes: conDosOcupadas(), seatVacia: 3 });

  assert.ok(nuevas.length > 0, "no repartió nada");
  for (const n of nuevas) {
    assert.notEqual(n.seatNumber, 3, "se lo dio a la vacante vacía");
    assert.ok([1, 2].includes(n.seatNumber));
  }
});

test("no le da a un jurado una consigna que ya tenía", () => {
  const vacantes = conDosOcupadas();
  const nuevas = repartirLoteHuerfano({ vacantes, seatVacia: 3 });
  for (const n of nuevas) {
    const destino = vacantes.find((v) => v.seatNumber === n.seatNumber)!;
    assert.equal(destino.consignas.includes(n.promptExternalId), false, n.promptExternalId);
  }
});

test("si no hay nadie ocupando, no se reparte nada", () => {
  const vacantes = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [],
  });
  assert.deepEqual(repartirLoteHuerfano({ vacantes, seatVacia: 3 }), []);
});

test("una vacante ocupada no se reparte", () => {
  const vacantes = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [{ seatNumber: 3, judgeAccountId: "j3", nombre: "Tres" }],
  });
  assert.deepEqual(repartirLoteHuerfano({ vacantes, seatVacia: 3 }), []);
});

test("una vacante que no existe no rompe nada", () => {
  assert.deepEqual(repartirLoteHuerfano({ vacantes: conDosOcupadas(), seatVacia: 9 }), []);
});

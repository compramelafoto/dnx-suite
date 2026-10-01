import test from "node:test";
import assert from "node:assert/strict";

import {
  pasosDelLote,
  resumenDeLaSituacion,
  tandasQueFaltan,
  type SituacionDelLote,
} from "./pasos-del-lote";

function situacion(p: Partial<SituacionDelLote> = {}): SituacionDelLote {
  return {
    estadoDelLote: null,
    sinEvaluar: 0,
    requierenRevision: 0,
    admitidas: 0,
    porTanda: 100,
    ...p,
  };
}

function estados(s: SituacionDelLote) {
  return pasosDelLote(s).map((p) => p.estado);
}

/** El paso N, o una falla con nombre si no está: `!` en cada línea esconde el motivo. */
function paso(s: SituacionDelLote, numero: 1 | 2 | 3 | 4) {
  const encontrado = pasosDelLote(s).find((p) => p.numero === numero);
  assert.ok(encontrado, `debería existir el paso ${numero}`);
  return encontrado;
}

test("sin lote creado, sólo el primer paso está disponible", () => {
  assert.deepEqual(estados(situacion()), ["AHORA", "ESPERA", "ESPERA", "ESPERA"]);
});

test("con el lote abierto, toca revisar", () => {
  const e = estados(situacion({ estadoDelLote: "DRAFT", sinEvaluar: 270 }));
  assert.deepEqual(e, ["HECHO", "AHORA", "ESPERA", "ESPERA"]);
});

test("con todo revisado, toca cerrar", () => {
  const e = estados(situacion({ estadoDelLote: "READY_TO_CLOSE", admitidas: 250 }));
  assert.deepEqual(e, ["HECHO", "HECHO", "AHORA", "ESPERA"]);
});

test("con el lote cerrado, toca congelar", () => {
  const e = estados(situacion({ estadoDelLote: "CLOSED", admitidas: 250 }));
  assert.deepEqual(e, ["HECHO", "HECHO", "HECHO", "AHORA"]);
});

test("congelado, los cuatro pasos están hechos", () => {
  const e = estados(situacion({ estadoDelLote: "FROZEN", admitidas: 250 }));
  assert.deepEqual(e, ["HECHO", "HECHO", "HECHO", "HECHO"]);
});

test("un lote cancelado se trata como si no existiera", () => {
  assert.deepEqual(estados(situacion({ estadoDelLote: "CANCELLED" })), [
    "AHORA",
    "ESPERA",
    "ESPERA",
    "ESPERA",
  ]);
});

/**
 * El caso que motivó todo: el botón procesa de a tandas, y sin decirlo alguien
 * aprieta una vez y no entiende por qué quedan fotos sin revisar.
 */
test("dice cuántas veces más hay que apretar", () => {
  assert.equal(tandasQueFaltan(270, 100), 3);
  assert.equal(tandasQueFaltan(170, 100), 2);
  assert.equal(tandasQueFaltan(100, 100), 1);
  assert.equal(tandasQueFaltan(1, 100), 1);
  assert.equal(tandasQueFaltan(0, 100), 0);
});

test("con varias tandas pendientes, el paso 2 lo aclara con números", () => {
  const paso2 = paso(situacion({ estadoDelLote: "DRAFT", sinEvaluar: 270 }), 2);
  assert.ok(paso2.aclaracion?.includes("270"));
  assert.ok(paso2.aclaracion?.includes("3"));
});

test("cerrar con fotos esperando decisión humana avisa que quedan afuera", () => {
  const paso3 = paso(
    situacion({ estadoDelLote: "READY_TO_CLOSE", requierenRevision: 12, admitidas: 200 }),
    3,
  );
  assert.ok(paso3.aclaracion?.includes("12"));
  assert.match(paso3.aclaracion!, /afuera/i);
});

test("congelar avisa del riesgo de reabrir, y deja de avisar una vez congelado", () => {
  const antes = paso(situacion({ estadoDelLote: "CLOSED", admitidas: 250 }), 4);
  assert.match(antes.aclaracion!, /reabrir/i);

  const despues = paso(situacion({ estadoDelLote: "FROZEN", admitidas: 250 }), 4);
  assert.equal(despues.aclaracion, null);
});

test("ningún texto de los pasos habla en jerga", () => {
  const todos = pasosDelLote(situacion({ estadoDelLote: "DRAFT", sinEvaluar: 270 }));
  for (const p of todos) {
    const texto = `${p.titulo} ${p.queHace} ${p.aclaracion ?? ""}`;
    for (const jerga of ["batch", "DRAFT", "FROZEN", "CLOSED", "status", "admissionStatus"]) {
      assert.ok(!texto.includes(jerga), `el paso ${p.numero} nombra "${jerga}"`);
    }
  }
});

test("el resumen dice dónde está parado el organizador", () => {
  assert.match(resumenDeLaSituacion(situacion()), /no empezaste/i);
  assert.match(
    resumenDeLaSituacion(situacion({ estadoDelLote: "DRAFT", sinEvaluar: 270 })),
    /270/,
  );
  assert.match(
    resumenDeLaSituacion(situacion({ estadoDelLote: "REVIEW_REQUIRED", requierenRevision: 5 })),
    /5/,
  );
  assert.match(
    resumenDeLaSituacion(situacion({ estadoDelLote: "CLOSED", admitidas: 250 })),
    /congelar/i,
  );
  assert.match(
    resumenDeLaSituacion(situacion({ estadoDelLote: "FROZEN", admitidas: 250 })),
    /jurado ya puede verlas/i,
  );
});

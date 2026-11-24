import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { armarCola, leerCola, siguienteDeLaCola } from "./cola-de-eleccion";

describe("cola de «Elegir de corrido»", () => {
  it("arma la cola sin repetidos y en orden", () => {
    assert.deepEqual(armarCola([3, 1, 3]), [3, 1]);
  });

  it("descarta ids inválidos", () => {
    assert.deepEqual(armarCola([0, -2, 5, Number.NaN, 2.5]), [5]);
  });

  it("al terminar uno sigue con el próximo", () => {
    assert.deepEqual(siguienteDeLaCola([3, 1], 3), { siguiente: 1, resto: [] });
  });

  it("sin hecho, toma el primero", () => {
    assert.deepEqual(siguienteDeLaCola([3, 1], null), { siguiente: 3, resto: [1] });
  });

  it("un hecho que no estaba en la cola no la altera", () => {
    assert.deepEqual(siguienteDeLaCola([3, 1], 9), { siguiente: 3, resto: [1] });
  });

  it("cola vacía: no hay siguiente", () => {
    assert.deepEqual(siguienteDeLaCola([], null), { siguiente: null, resto: [] });
  });

  it("lee lo guardado aunque esté roto", () => {
    assert.deepEqual(leerCola("[4,4,2]"), [4, 2]);
    assert.deepEqual(leerCola("no es json"), []);
    assert.deepEqual(leerCola(null), []);
    assert.deepEqual(leerCola('{"a":1}'), []);
  });
});

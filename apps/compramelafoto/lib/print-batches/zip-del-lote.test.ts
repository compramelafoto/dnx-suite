import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { PEDIDOS_POR_PARTE, nombreDeLaParte, partesDelLote } from "./partes-del-lote";

const ids = (n: number) => Array.from({ length: n }, (_, i) => 1000 + i);

describe("partesDelLote", () => {
  it("de a 15 pedidos por parte", () => {
    assert.equal(PEDIDOS_POR_PARTE, 15);
  });

  it("sin pedidos no hay partes", () => {
    assert.deepEqual(partesDelLote([]), []);
  });

  it("15 pedidos entran en una sola parte", () => {
    assert.deepEqual(partesDelLote(ids(15)), [ids(15)]);
  });

  it("16 pedidos van en dos partes: 15 y 1", () => {
    const partes = partesDelLote(ids(16));
    assert.deepEqual(partes.map((p) => p.length), [15, 1]);
    assert.deepEqual(partes[1], [1015]);
  });

  it("respeta el orden en que vienen", () => {
    const desordenados = [9, 3, 7, ...ids(14), 1];
    assert.deepEqual(partesDelLote(desordenados).flat(), desordenados);
  });
});

describe("nombreDeLaParte", () => {
  it("«<Lote> - parte <k> de <n>.zip»", () => {
    assert.equal(nombreDeLaParte("Lote 4", 2, 3), "Lote 4 - parte 2 de 3.zip");
  });
});

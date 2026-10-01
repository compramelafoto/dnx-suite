import test from "node:test";
import assert from "node:assert/strict";

import { proximaTanda } from "./proxima-tanda";

const TODOS = Array.from({ length: 270 }, (_, i) => ({ id: `foto-${i + 1}` }));

function ids(envios: Array<{ id: string }>): string[] {
  return envios.map((e) => e.id);
}

test("la primera pasada toma las primeras de la tanda", () => {
  const tanda = proximaTanda({ envios: TODOS, yaDecididos: new Set(), porTanda: 100 });
  assert.equal(tanda.length, 100);
  assert.equal(tanda[0]?.id, "foto-1");
  assert.equal(tanda[99]?.id, "foto-100");
});

/**
 * El defecto real: apretar de nuevo repetía las mismas 100 y nunca llegaba a
 * las siguientes.
 */
test("la segunda pasada avanza, no repite", () => {
  const primera = proximaTanda({ envios: TODOS, yaDecididos: new Set(), porTanda: 100 });
  const segunda = proximaTanda({
    envios: TODOS,
    yaDecididos: new Set(ids(primera)),
    porTanda: 100,
  });

  assert.equal(segunda[0]?.id, "foto-101");
  for (const e of segunda) {
    assert.ok(!ids(primera).includes(e.id), `${e.id} ya se había revisado`);
  }
});

test("tres pasadas cubren las 270 sin repetir ninguna", () => {
  const decididos = new Set<string>();
  const vistas: string[] = [];

  for (let i = 0; i < 3; i++) {
    const tanda = proximaTanda({ envios: TODOS, yaDecididos: decididos, porTanda: 100 });
    for (const e of tanda) {
      decididos.add(e.id);
      vistas.push(e.id);
    }
  }

  assert.equal(vistas.length, 270);
  assert.equal(new Set(vistas).size, 270, "ninguna se revisó dos veces");
});

test("la última pasada trae sólo lo que falta", () => {
  const decididos = new Set(ids(TODOS.slice(0, 200)));
  const tanda = proximaTanda({ envios: TODOS, yaDecididos: decididos, porTanda: 100 });
  assert.equal(tanda.length, 70);
});

test("con todo revisado no queda nada por hacer", () => {
  const tanda = proximaTanda({
    envios: TODOS,
    yaDecididos: new Set(ids(TODOS)),
    porTanda: 100,
  });
  assert.deepEqual(tanda, []);
});

test("sin envíos no explota", () => {
  assert.deepEqual(proximaTanda({ envios: [], yaDecididos: new Set(), porTanda: 100 }), []);
});

test("un tamaño de tanda inválido no devuelve todo de golpe", () => {
  for (const porTanda of [0, -5]) {
    assert.deepEqual(
      proximaTanda({ envios: TODOS, yaDecididos: new Set(), porTanda }),
      [],
      `porTanda ${porTanda} no debería procesar nada`,
    );
  }
});

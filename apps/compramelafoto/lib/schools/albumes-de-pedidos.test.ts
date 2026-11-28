import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { albumParaLaRegla, albumesDeLosPedidos } from "./albumes-de-pedidos";

const a1 = { id: 1, title: "Colegio Goethe - 5º Año" };
const a2 = { id: 2, title: "Colegio Goethe - 1º Año" };

describe("albumesDeLosPedidos", () => {
  it("junta los álbumes sin repetir, ordenados por nombre, y salta los pedidos sin álbum", () => {
    assert.deepEqual(albumesDeLosPedidos([{ album: a1 }, { album: null }, { album: a2 }, { album: a1 }]), [a2, a1]);
  });
});

describe("albumParaLaRegla", () => {
  it("sin colegio elegido no hay regla que cambiar", () => {
    assert.equal(albumParaLaRegla(false, [a1], null), null);
  });
  it("con un solo álbum en el colegio, es ése", () => {
    assert.deepEqual(albumParaLaRegla(true, [a1], null), a1);
  });
  it("con varios álbumes hay que elegir uno", () => {
    assert.equal(albumParaLaRegla(true, [a1, a2], null), null);
    assert.deepEqual(albumParaLaRegla(true, [a1, a2], 2), a2);
  });
  it("un álbum elegido que ya no está en la lista no vale", () => {
    assert.equal(albumParaLaRegla(true, [a1], 2), null);
  });
});

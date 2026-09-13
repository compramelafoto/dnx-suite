import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  addToVideoCart,
  clearVideoCart,
  readVideoCart,
  removeFromVideoCart,
  videoCartKey,
} from "./video-cart-storage";

/** sessionStorage de mentira, para probar sin navegador. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    _raw: data,
  };
}

let store = fakeStorage();
beforeEach(() => {
  store = fakeStorage();
});

describe("carrito de videos del cliente", () => {
  it("arranca vacío", () => {
    assert.deepEqual(readVideoCart(1, store), []);
  });

  it("agrega y lee", () => {
    addToVideoCart(1, 10, store);
    addToVideoCart(1, 11, store);
    assert.deepEqual(readVideoCart(1, store), [10, 11]);
  });

  it("no agrega dos veces el mismo video", () => {
    addToVideoCart(1, 10, store);
    addToVideoCart(1, 10, store);
    assert.deepEqual(readVideoCart(1, store), [10]);
  });

  it("cada álbum tiene su propio carrito", () => {
    addToVideoCart(1, 10, store);
    addToVideoCart(2, 20, store);
    assert.deepEqual(readVideoCart(1, store), [10]);
    assert.deepEqual(readVideoCart(2, store), [20]);
  });

  it("quita un video sin tocar los demás", () => {
    addToVideoCart(1, 10, store);
    addToVideoCart(1, 11, store);
    removeFromVideoCart(1, 10, store);
    assert.deepEqual(readVideoCart(1, store), [11]);
  });

  it("vacía el carrito después de comprar", () => {
    addToVideoCart(1, 10, store);
    clearVideoCart(1, store);
    assert.deepEqual(readVideoCart(1, store), []);
  });

  it("un carrito corrupto se lee como vacío en vez de romper la pantalla", () => {
    store.setItem(videoCartKey(1), "{no es json");
    assert.deepEqual(readVideoCart(1, store), []);
  });

  it("descarta valores que no son ids válidos", () => {
    store.setItem(videoCartKey(1), JSON.stringify([10, "abc", null, -5, 0, 11]));
    assert.deepEqual(readVideoCart(1, store), [10, 11]);
  });

  it("sin almacenamiento disponible no explota", () => {
    // Safari en navegación privada puede tirar excepción al escribir.
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    assert.deepEqual(readVideoCart(1, roto), []);
    assert.doesNotThrow(() => addToVideoCart(1, 10, roto));
    assert.doesNotThrow(() => clearVideoCart(1, roto));
  });
});

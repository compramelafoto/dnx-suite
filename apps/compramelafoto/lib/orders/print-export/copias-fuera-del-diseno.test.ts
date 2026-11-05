import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { copiasFueraDelDiseno } from "./copias-fuera-del-diseno";

const item = (id: number, photoId: number, size: string, quantity = 1) => ({ id, photoId, size, quantity });

describe("copiasFueraDelDiseno", () => {
  it("saca las fotos del librito y deja las copias de otras fotos", () => {
    const items = [item(1, 10, "Librito"), item(2, 20, "Librito"), item(3, 30, "15x21 cm")];
    assert.deepEqual(copiasFueraDelDiseno(items, [10, 20]).map((i) => i.id), [3]);
  });

  it("una copia de la misma foto del librito sigue yendo suelta", () => {
    // La copia aparece antes que el ítem del librito: igual se descuenta del librito.
    const items = [item(1, 10, "15x21 cm"), item(2, 10, "Librito"), item(3, 20, "Librito")];
    assert.deepEqual(copiasFueraDelDiseno(items, [10, 20]).map((i) => i.id), [1]);
  });

  it("si librito y copia vienen en un mismo ítem, queda una unidad suelta", () => {
    const out = copiasFueraDelDiseno([item(1, 10, "15x21 cm", 2)], [10]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.quantity, 1);
  });

  it("sin diseños no cambia nada", () => {
    const items = [item(1, 10, "15x21 cm"), item(2, 20, "10x15 cm", 3)];
    assert.deepEqual(copiasFueraDelDiseno(items, []), items);
  });
});

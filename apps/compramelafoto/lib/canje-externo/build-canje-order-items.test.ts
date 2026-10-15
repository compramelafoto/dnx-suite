import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCanjeOrderItems } from "./build-canje-order-items";

const PRODUCTO = { productId: 582, name: "Foto impresa", size: "15x21 cm", finish: "mate" };

describe("buildCanjeOrderItems", () => {
  it("las fotos del combo van primero, aunque la extra se haya elegido antes", () => {
    const items = buildCanjeOrderItems(
      { comboPhotoIds: [1, 2, 3], extras: [{ photoId: 9, format: "impresa" }] },
      PRODUCTO,
      true
    );
    const impresas = items.filter((i) => i.tipo === "impresa").map((i) => i.fileKey);
    assert.deepEqual(impresas, ["photo:1", "photo:2", "photo:3", "photo:9"]);
  });

  it("con digital incluido, cada impresa lleva su digital antes", () => {
    const items = buildCanjeOrderItems({ comboPhotoIds: [1], extras: [] }, PRODUCTO, true);
    assert.equal(items.length, 2);
    assert.equal(items[0].includedWithPrint, true);
    assert.equal(items[1].tipo, "impresa");
    assert.equal(items[1].productId, 582);
    assert.equal(items[1].size, "15x21 cm");
    assert.equal(items[1].finish, "MATE");
  });

  it("sin digital incluido no agrega la línea digital", () => {
    const items = buildCanjeOrderItems({ comboPhotoIds: [1, 2], extras: [] }, PRODUCTO, false);
    assert.ok(items.every((i) => i.tipo === "impresa"));
  });

  it("una extra sólo digital es un digital suelto, no incluido con impresa", () => {
    const items = buildCanjeOrderItems(
      { comboPhotoIds: [1], extras: [{ photoId: 7, format: "digital" }] },
      PRODUCTO,
      true
    );
    const ultima = items[items.length - 1];
    assert.equal(ultima.fileKey, "photo:7");
    assert.equal(ultima.tipo, "digital");
    assert.ok(!ultima.includedWithPrint);
  });
});

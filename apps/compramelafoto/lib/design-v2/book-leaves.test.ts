import assert from "node:assert/strict";
import { test } from "node:test";
import { bookLeaves, bookSpreadLabel, isBookTemplate } from "./book-leaves";

test("un librito es un pliego apaisado con tapa e interior", () => {
  assert.equal(isBookTemplate({ pageCount: 2, canvas: { width: 3602, height: 2421 } }), true);
  assert.equal(isBookTemplate({ pageCount: 1, canvas: { width: 3602, height: 2421 } }), false);
  assert.equal(isBookTemplate({ pageCount: 3, canvas: { width: 1200, height: 1800 } }), false);
});

test("tapa e interior: dos hojas, la contratapa al dorso de la última", () => {
  assert.deepEqual(bookLeaves(2), [
    { front: { pageIndex: 0, half: "right" }, back: { pageIndex: 1, half: "left" } },
    { front: { pageIndex: 1, half: "right" }, back: { pageIndex: 0, half: "left" } },
  ]);
});

test("cada pliego interior suma una hoja", () => {
  const leaves = bookLeaves(4);
  assert.equal(leaves.length, 4);
  assert.deepEqual(leaves[1], { front: { pageIndex: 1, half: "right" }, back: { pageIndex: 2, half: "left" } });
  assert.deepEqual(leaves[3].back, { pageIndex: 0, half: "left" });
  assert.deepEqual(bookLeaves(1), []);
});

test("el contador nombra tapa, páginas y contratapa", () => {
  assert.equal(bookSpreadLabel(0, 3), "Tapa");
  assert.equal(bookSpreadLabel(1, 3), "Páginas 1 y 2");
  assert.equal(bookSpreadLabel(2, 3), "Páginas 3 y 4");
  assert.equal(bookSpreadLabel(3, 3), "Contratapa");
});

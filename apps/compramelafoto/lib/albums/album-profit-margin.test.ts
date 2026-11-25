import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAlbumProfitMarginPercent } from "./album-profit-margin";

test("un margen de 0% se guarda como 0, no se borra", () => {
  assert.equal(parseAlbumProfitMarginPercent(0), 0);
  assert.equal(parseAlbumProfitMarginPercent("0"), 0);
});

test("los márgenes positivos se guardan tal cual", () => {
  assert.equal(parseAlbumProfitMarginPercent(15), 15);
  assert.equal(parseAlbumProfitMarginPercent("12,5"), 12.5);
});

test("vacío o inválido queda sin margen", () => {
  assert.equal(parseAlbumProfitMarginPercent(null), null);
  assert.equal(parseAlbumProfitMarginPercent(""), null);
  assert.equal(parseAlbumProfitMarginPercent("abc"), null);
  assert.equal(parseAlbumProfitMarginPercent(-5), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePackSavings,
  findPackForSinglesSelection,
  isFixedDigitalPack,
  type PackForSinglesComparison,
} from "./pack-vs-singles";

function pack(over: Partial<PackForSinglesComparison>): PackForSinglesComparison {
  return {
    id: "p",
    name: "10 archivos digitales",
    price: 50000,
    clientPriceArs: 57500,
    includedPhotoCount: 10,
    requiresSelection: true,
    selectionMode: "FIXED",
    compositionFulfillmentKind: "DIGITAL",
    ...over,
  };
}

// Precio unitario de los álbumes de Fotoshow: 6.500 + 15 % = 7.475.
const singles = (n: number) => n * 7475;

test("ahorro del pack de 10 de Fotoshow frente a 10 sueltas", () => {
  const s = computePackSavings(57500, singles(10));
  assert.deepEqual(s, {
    singlesTotalArs: 74750,
    packTotalArs: 57500,
    savingsArs: 17250,
    savingsPercent: 23,
  });
});

test("si el pack no es más barato no hay ahorro", () => {
  assert.equal(computePackSavings(80000, 74750), null);
  assert.equal(computePackSavings(74750, 74750), null);
  assert.equal(computePackSavings(0, 74750), null);
});

test("sólo los packs digitales de cantidad fija se comparan con sueltas", () => {
  assert.equal(isFixedDigitalPack(pack({})), true);
  assert.equal(isFixedDigitalPack(pack({ compositionFulfillmentKind: "MIXED" })), false);
  assert.equal(isFixedDigitalPack(pack({ compositionFulfillmentKind: "PRINT" })), false);
  assert.equal(isFixedDigitalPack(pack({ selectionMode: "ALL_MY_PHOTOS" })), false);
  assert.equal(isFixedDigitalPack(pack({ includedPhotoCount: null })), false);
  assert.equal(isFixedDigitalPack(pack({ requiresSelection: false })), false);
});

test("10 fotos sueltas sugieren el pack de 10", () => {
  const packs = [
    pack({ id: "5", name: "5 archivos digitales", includedPhotoCount: 5, clientPriceArs: 34500 }),
    pack({ id: "10" }),
    pack({ id: "10mix", compositionFulfillmentKind: "MIXED", clientPriceArs: 40000 }),
  ];
  const found = findPackForSinglesSelection(packs, 10, singles);
  assert.equal(found?.pack.id, "10");
  assert.equal(found?.savings.savingsArs, 17250);
  assert.equal(findPackForSinglesSelection(packs, 5, singles)?.pack.id, "5");
});

test("sin pack de esa cantidad exacta no se sugiere nada", () => {
  const packs = [pack({ id: "10" })];
  assert.equal(findPackForSinglesSelection(packs, 9, singles), null);
  assert.equal(findPackForSinglesSelection(packs, 11, singles), null);
  assert.equal(findPackForSinglesSelection(packs, 0, singles), null);
});

test("con dos packs de la misma cantidad sugiere el más barato", () => {
  const packs = [pack({ id: "caro", clientPriceArs: 60000 }), pack({ id: "barato", clientPriceArs: 55000 })];
  assert.equal(findPackForSinglesSelection(packs, 10, singles)?.pack.id, "barato");
});

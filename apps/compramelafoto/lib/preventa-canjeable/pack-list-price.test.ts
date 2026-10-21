import assert from "node:assert/strict";
import { test } from "node:test";

import { packListPrice, splitPackDescription } from "./pack-list-price";

/**
 * Colación Sala de 5 del San Patricio: lista $35.000 y preventa $28.000 (pack 1),
 * lista $68.750 y preventa $55.000 (pack 2). Los dos son 20% OFF.
 */
test("pack 1: suma el precio regular de cada copia y da 20% OFF", () => {
  assert.deepEqual(
    packListPrice(28000, [
      { includedQuantity: 1, regularUnitPriceAfterPreventaArs: 11667 },
      { includedQuantity: 1, regularUnitPriceAfterPreventaArs: 11667 },
      { includedQuantity: 1, regularUnitPriceAfterPreventaArs: 11666 },
      { includedQuantity: 3, regularUnitPriceAfterPreventaArs: null },
    ]),
    { listPriceArs: 35000, discountPercent: 20 }
  );
});

test("pack 2: librito de lista $68.750 contra $55.000 es 20% OFF", () => {
  assert.deepEqual(packListPrice(55000, [{ includedQuantity: 1, regularUnitPriceAfterPreventaArs: 68750 }]), {
    listPriceArs: 68750,
    discountPercent: 20,
  });
});

test("multiplica por la cantidad incluida", () => {
  assert.deepEqual(packListPrice(30000, [{ includedQuantity: 2, regularUnitPriceAfterPreventaArs: 20000 }]), {
    listPriceArs: 40000,
    discountPercent: 25,
  });
});

test("Goethe: lista igual al precio no muestra tachado ni OFF", () => {
  assert.equal(
    packListPrice(46460, [
      { includedQuantity: 1, regularUnitPriceAfterPreventaArs: 23230 },
      { includedQuantity: 1, regularUnitPriceAfterPreventaArs: 23230 },
    ]),
    null
  );
});

test("sin precio regular cargado no muestra nada", () => {
  assert.equal(packListPrice(28000, [{ includedQuantity: 3 }]), null);
  assert.equal(packListPrice(28000, []), null);
});

test("nunca inventa un descuento si la lista es menor", () => {
  assert.equal(packListPrice(28000, [{ includedQuantity: 1, regularUnitPriceAfterPreventaArs: 20000 }]), null);
});

test("separa las líneas de regalo (🎁) del resto de la descripción", () => {
  const r = splitPackDescription("Incluye 3 copias.\n🎁 De regalo: la foto grupal.\n\nCobertura sujeta a un mínimo.");
  assert.deepEqual(r.giftLines, ["De regalo: la foto grupal."]);
  assert.deepEqual(r.otherLines, ["Incluye 3 copias.", "Cobertura sujeta a un mínimo."]);
});

test("sin descripción devuelve listas vacías", () => {
  assert.deepEqual(splitPackDescription(null), { giftLines: [], otherLines: [] });
});

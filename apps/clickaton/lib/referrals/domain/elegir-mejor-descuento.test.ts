import assert from "node:assert/strict";
import test from "node:test";

import { elegirMejorDescuento } from "./elegir-mejor-descuento";

const PRECIO = 3_500_000; // $35.000 en centavos

test("sin cupón ni referidos se paga el precio entero", () => {
  const r = elegirMejorDescuento({ montoOriginal: PRECIO, colegas: 0, cupon: null });
  assert.equal(r.gana, "ninguno");
  assert.equal(r.montoFinal, PRECIO);
  assert.equal(r.consumeReferidos, false);
});

test("sin cupón, el beneficio de referidos se aplica solo", () => {
  const r = elegirMejorDescuento({ montoOriginal: PRECIO, colegas: 2, cupon: null });
  assert.equal(r.gana, "referidos");
  assert.equal(r.descuentoAplicado, 700_000); // 20%
  assert.equal(r.montoFinal, 2_800_000);
  assert.equal(r.consumeReferidos, true);
  assert.equal(r.colegasConsumidos, 2);
});

test("NO se suman: con un cupón mejor gana el cupón", () => {
  const r = elegirMejorDescuento({
    montoOriginal: PRECIO,
    colegas: 1, // 10%
    cupon: { descuento: 1_750_000 }, // 50%
  });
  assert.equal(r.gana, "cupon");
  assert.equal(r.descuentoAplicado, 1_750_000);
  assert.equal(r.montoFinal, 1_750_000);
});

test("cuando gana el cupón, los referidos NO se consumen: quedan para la próxima", () => {
  // Es la regla que más le importa al participante: lo que no se usó, se conserva.
  const r = elegirMejorDescuento({
    montoOriginal: PRECIO,
    colegas: 1,
    cupon: { descuento: 1_750_000 },
  });
  assert.equal(r.consumeReferidos, false);
  assert.equal(r.colegasConsumidos, 0);
});

test("con referidos mejores que el cupón gana el beneficio", () => {
  const r = elegirMejorDescuento({
    montoOriginal: PRECIO,
    colegas: 4, // 60% = 2.100.000
    cupon: { descuento: 350_000 }, // 10%
  });
  assert.equal(r.gana, "referidos");
  assert.equal(r.montoFinal, 1_400_000);
  assert.equal(r.consumeReferidos, true);
});

test("en empate gana el cupón, para preservar los referidos", () => {
  const r = elegirMejorDescuento({
    montoOriginal: PRECIO,
    colegas: 5, // 100%
    cupon: { descuento: PRECIO }, // 100%
  });
  assert.equal(r.gana, "cupon");
  assert.equal(r.montoFinal, 0);
  assert.equal(r.consumeReferidos, false, "sale con sus 5 colegas intactos");
});

test("cinco colegas dejan la inscripción en cero", () => {
  const r = elegirMejorDescuento({ montoOriginal: PRECIO, colegas: 5, cupon: null });
  assert.equal(r.montoFinal, 0);
  assert.equal(r.descuentoAplicado, PRECIO);
});

test("sobre una entrada gratuita no se consume nada", () => {
  // Consumir 5 colegas para descontar $0 sería quemarlos.
  const r = elegirMejorDescuento({ montoOriginal: 0, colegas: 5, cupon: null });
  assert.equal(r.gana, "ninguno");
  assert.equal(r.montoFinal, 0);
  assert.equal(r.consumeReferidos, false);
});

test("el monto final nunca es negativo", () => {
  const r = elegirMejorDescuento({
    montoOriginal: 1000,
    colegas: 0,
    cupon: { descuento: 999_999 },
  });
  assert.equal(r.montoFinal, 0);
  assert.equal(r.descuentoAplicado, 1000);
});

test("el descuento por referidos se redondea a favor del participante", () => {
  // 35% de 999 = 349,65 → 350 de descuento, no 349.
  const r = elegirMejorDescuento({ montoOriginal: 999, colegas: 3, cupon: null });
  assert.equal(r.descuentoAplicado, 350);
  assert.equal(r.montoFinal, 649);
});

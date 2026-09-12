import assert from "node:assert/strict";
import test from "node:test";

import { assertSharesSumTo100, splitAmountByAllocation } from "./allocation";

test("un gasto de una sola plataforma se le asigna entero", () => {
  const partes = splitAmountByAllocation(100_00, [{ platformKey: "clf", sharePercent: 100 }]);

  assert.deepEqual(partes, [{ platformKey: "clf", sharePercent: 100, amountArsMinor: 100_00 }]);
});

test("las partes suman exactamente el total, sin centavos perdidos", () => {
  const partes = splitAmountByAllocation(100_00, [
    { platformKey: "clf", sharePercent: 33.33 },
    { platformKey: "fotoffice", sharePercent: 33.33 },
    { platformKey: "fotorank", sharePercent: 33.34 },
  ]);

  const suma = partes.reduce((total, parte) => total + parte.amountArsMinor, 0);
  assert.equal(suma, 100_00);
});

test("el centavo sobrante va a la plataforma con el resto más grande", () => {
  // clf (30%) y suite (70%) sobre 10_01 dan restos distintos (0.3 y 0.7):
  // si se sacara el .sort() por resto, el centavo sobrante iría al primero
  // del arreglo (clf) en lugar de a quien realmente tiene el resto mayor
  // (suite), y esta prueba fallaría.
  const partes = splitAmountByAllocation(10_01, [
    { platformKey: "clf", sharePercent: 30 },
    { platformKey: "suite", sharePercent: 70 },
  ]);

  const suma = partes.reduce((total, parte) => total + parte.amountArsMinor, 0);
  assert.equal(suma, 10_01);
  assert.equal(partes.find((parte) => parte.platformKey === "clf")?.amountArsMinor, 300);
  assert.equal(partes.find((parte) => parte.platformKey === "suite")?.amountArsMinor, 701);
});

test("un reparto con más de dos decimales que parece sumar 100 pero en realidad no, se rechaza", () => {
  // Contraejemplo del reviewer: 50.0025 + 50.0025 = 100.005, que pasaba con
  // la tolerancia vieja (±0.005) pero no suma exactamente 100.
  const sharesInvalidas = [
    { platformKey: "clf", sharePercent: 50.0025 },
    { platformKey: "suite", sharePercent: 50.0025 },
  ];

  assert.throws(() => assertSharesSumTo100(sharesInvalidas), /100/);
  assert.throws(() => splitAmountByAllocation(10_000_000, sharesInvalidas), /100/);
});

test("un monto grande repartido entre las 5 plataformas reales suma exacto aunque divida disparejo", () => {
  const partes = splitAmountByAllocation(10_000_003, [
    { platformKey: "clf", sharePercent: 25.5 },
    { platformKey: "fotoffice", sharePercent: 25.3 },
    { platformKey: "fotorank", sharePercent: 20.1 },
    { platformKey: "clickaton", sharePercent: 15.05 },
    { platformKey: "infospot", sharePercent: 14.05 },
  ]);

  const suma = partes.reduce((total, parte) => total + parte.amountArsMinor, 0);
  assert.equal(suma, 10_000_003);
});

test("el mensaje de error redondea la suma para no mostrar ruido de punto flotante", () => {
  // 10 + 33.38 + 39.95 da en punto flotante 83.33000000000001, no 83.33.
  // El mensaje tiene que mostrar la cifra redondeada a dos decimales, no el
  // valor crudo con ruido.
  const sharesConRuido = [
    { platformKey: "clf", sharePercent: 10 },
    { platformKey: "fotoffice", sharePercent: 33.38 },
    { platformKey: "fotorank", sharePercent: 39.95 },
  ];
  const suma = sharesConRuido.reduce((total, parte) => total + parte.sharePercent, 0);
  assert.equal(String(suma), "83.33000000000001");

  assert.throws(() => assertSharesSumTo100(sharesConRuido), /suma 83\.33% /);
});

test("un reparto que no suma 100 es un error explícito", () => {
  assert.throws(
    () =>
      assertSharesSumTo100([
        { platformKey: "clf", sharePercent: 50 },
        { platformKey: "fotoffice", sharePercent: 30 },
      ]),
    /100/,
  );
});

test("un reparto que suma 100 no da error", () => {
  assert.doesNotThrow(() =>
    assertSharesSumTo100([
      { platformKey: "clf", sharePercent: 50 },
      { platformKey: "fotoffice", sharePercent: 50 },
    ]),
  );
});

test("un share fuera de rango se rechaza aunque la suma dé 100", () => {
  // -10% y 110% suman 100%, pero un porcentaje negativo o mayor a 100 no
  // tiene sentido: clasificaría un monto espurio como gasto "directo" y
  // dejaría el prorrateo de otra plataforma en negativo.
  assert.throws(
    () =>
      assertSharesSumTo100([
        { platformKey: "clf", sharePercent: -10 },
        { platformKey: "fotoffice", sharePercent: 110 },
      ]),
    /clf/,
  );
});

test("los shares en los bordes (0% y 100%) son válidos", () => {
  assert.doesNotThrow(() =>
    assertSharesSumTo100([
      { platformKey: "clf", sharePercent: 0 },
      { platformKey: "fotoffice", sharePercent: 100 },
    ]),
  );
});

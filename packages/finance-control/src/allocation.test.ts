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
  const partes = splitAmountByAllocation(10_01, [
    { platformKey: "clf", sharePercent: 50 },
    { platformKey: "suite", sharePercent: 50 },
  ]);

  const suma = partes.reduce((total, parte) => total + parte.amountArsMinor, 0);
  assert.equal(suma, 10_01);
  assert.equal(partes.length, 2);
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

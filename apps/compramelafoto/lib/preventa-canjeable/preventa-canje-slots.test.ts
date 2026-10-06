import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildCanjeSlotPlan,
  buildRedeemSelections,
  emptyCanjeFill,
  isCanjeComplete,
  studentNameForGreeting,
  toggleCanjePhoto,
} from "./preventa-canje-slots";

const IMPRESA_Y_DIGITAL = { sellPrint: true, sellDigital: true };
const SOLO_DIGITAL = { sellPrint: false, sellDigital: true };

function ben(over: Partial<Parameters<typeof buildCanjeSlotPlan>[0][number]>) {
  return {
    stableKey: "1:benefit:1",
    kind: "PHYSICAL" as const,
    selectionMode: "SINGLE_PHOTO" as const,
    includedQuantity: 1,
    requiredPhotoCount: 1,
    sortOrder: 0,
    name: "Copia grupal",
    ...over,
  };
}

describe("buildCanjeSlotPlan", () => {
  it("Goethe Pack 1: una copia grupal es un lugar", () => {
    const plan = buildCanjeSlotPlan([ben({})]);
    assert.equal(plan.slots.length, 1);
    assert.equal(plan.groups[0].label, "Copia grupal");
  });

  it("el título deja el producto y saca la cantidad que ya se dice abajo", () => {
    const plan = buildCanjeSlotPlan([
      ben({ stableKey: "a", name: "1× Copia grupal" }),
      ben({ stableKey: "b", name: "2 impresos", sortOrder: 1 }),
      ben({ stableKey: "c", kind: "DIGITAL", name: "2 descargas · 2 fotos por descarga", sortOrder: 2 }),
      ben({ stableKey: "d", name: "1× Librito 5º · 2 fotos c/u", sortOrder: 3 }),
    ]);
    assert.deepEqual(
      plan.groups.map((g) => g.label),
      ["Copia grupal", "Fotos impresas", "Fotos digitales", "Librito 5º"]
    );
  });

  it("Claudia Valenti: 2 impresas + 2 digitales de 2 fotos c/u son 6 lugares", () => {
    const plan = buildCanjeSlotPlan([
      ben({ stableKey: "9:benefit:1", includedQuantity: 2, name: "Carpeta impresa" }),
      ben({
        stableKey: "9:benefit:2",
        kind: "DIGITAL",
        selectionMode: "MULTI_PHOTO_FIXED",
        includedQuantity: 2,
        requiredPhotoCount: 2,
        sortOrder: 1,
        name: "Digitales",
      }),
    ]);
    assert.equal(plan.slots.length, 6);
    assert.deepEqual(
      plan.groups.map((g) => [g.label, g.slotIndexes.length]),
      [
        ["Carpeta impresa", 2],
        ["Digitales", 4],
      ]
    );
  });

  it("respeta el orden de los beneficios del pack", () => {
    const plan = buildCanjeSlotPlan([
      ben({ stableKey: "b", sortOrder: 2, name: "Segundo" }),
      ben({ stableKey: "a", sortOrder: 1, name: "Primero" }),
    ]);
    assert.deepEqual(
      plan.groups.map((g) => g.label),
      ["Primero", "Segundo"]
    );
  });
});

describe("toggleCanjePhoto", () => {
  const plan = buildCanjeSlotPlan([
    ben({ stableKey: "p", includedQuantity: 1, name: "Impresa" }),
    ben({ stableKey: "d", kind: "DIGITAL", sortOrder: 1, name: "Digital" }),
  ]);

  it("una foto sólo digital salta el lugar impreso y va al digital", () => {
    const r = toggleCanjePhoto(plan, emptyCanjeFill(plan), 10, SOLO_DIGITAL);
    assert.ok(r.ok);
    assert.deepEqual(r.filled, [null, 10]);
  });

  it("tocar de nuevo la saca", () => {
    const uno = toggleCanjePhoto(plan, emptyCanjeFill(plan), 10, IMPRESA_Y_DIGITAL);
    const dos = toggleCanjePhoto(plan, uno.filled, 10, IMPRESA_Y_DIGITAL);
    assert.deepEqual(dos.filled, [null, null]);
  });

  it("con todo lleno avisa en vez de pisar", () => {
    let f = emptyCanjeFill(plan);
    f = toggleCanjePhoto(plan, f, 1, IMPRESA_Y_DIGITAL).filled;
    f = toggleCanjePhoto(plan, f, 2, IMPRESA_Y_DIGITAL).filled;
    const r = toggleCanjePhoto(plan, f, 3, IMPRESA_Y_DIGITAL);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, "lleno");
    assert.ok(isCanjeComplete(f));
  });

  it("si queda lugar pero no de su formato, dice que no corresponde", () => {
    const f = toggleCanjePhoto(plan, emptyCanjeFill(plan), 1, SOLO_DIGITAL).filled;
    const r = toggleCanjePhoto(plan, f, 2, SOLO_DIGITAL);
    assert.equal(!r.ok && r.reason, "no_corresponde");
  });
});

describe("buildRedeemSelections", () => {
  it("arma una selección por beneficio con sus unidades", () => {
    const plan = buildCanjeSlotPlan([
      ben({ stableKey: "p", includedQuantity: 2 }),
      ben({
        stableKey: "d",
        kind: "DIGITAL",
        selectionMode: "MULTI_PHOTO_FIXED",
        includedQuantity: 1,
        requiredPhotoCount: 2,
        sortOrder: 1,
      }),
    ]);
    let f = emptyCanjeFill(plan);
    for (const id of [11, 12, 13, 14]) f = toggleCanjePhoto(plan, f, id, IMPRESA_Y_DIGITAL).filled;
    assert.deepEqual(buildRedeemSelections(plan, f), [
      { benefitStableKey: "p", units: [[11], [12]] },
      { benefitStableKey: "d", units: [[13, 14]] },
    ]);
  });
});

describe("studentNameForGreeting", () => {
  it("si la familia cargó su propio nombre como alumno, no lo repite", () => {
    assert.equal(studentNameForGreeting("Stephanie Hourcade", "Stephanie hourcade"), null);
  });
  it("con el nombre del alumno real, lo usa", () => {
    assert.equal(studentNameForGreeting("Amelia Lobrauco", "Silvana Szekieta"), "Amelia Lobrauco");
  });
  it("sin alumno no inventa", () => {
    assert.equal(studentNameForGreeting("  ", "Ana"), null);
  });
});

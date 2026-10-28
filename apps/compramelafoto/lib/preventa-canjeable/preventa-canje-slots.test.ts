import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoAssignClientPhotos, clientPhotoInputs, listClientPhotoSlots } from "@repo/template-editor-core";

import {
  buildCanjeSlotPlan,
  buildRedeemSelections,
  currentCanjeSlotIndex,
  emptyCanjeFill,
  photosForCanjeRole,
  placesForUnit,
  isCanjeComplete,
  removeCanjePhotoFromBenefit,
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

  it("tocar de nuevo la suma también en digital; una vez más, la saca", () => {
    const uno = toggleCanjePhoto(plan, emptyCanjeFill(plan), 10, IMPRESA_Y_DIGITAL);
    const dos = toggleCanjePhoto(plan, uno.filled, 10, IMPRESA_Y_DIGITAL);
    assert.deepEqual(dos.filled, [10, 10]);
    assert.ok(dos.ok && dos.repetida);
    const tres = toggleCanjePhoto(plan, dos.filled, 10, IMPRESA_Y_DIGITAL);
    assert.deepEqual(tres.filled, [10, null]);
    const cuatro = toggleCanjePhoto(plan, tres.filled, 10, IMPRESA_Y_DIGITAL);
    assert.deepEqual(cuatro.filled, [10, 10]);
  });

  it("si no entra en otro beneficio, tocarla la saca", () => {
    const soloImpresa = buildCanjeSlotPlan([ben({ stableKey: "p", includedQuantity: 2, name: "Impresa" })]);
    const uno = toggleCanjePhoto(soloImpresa, emptyCanjeFill(soloImpresa), 10, IMPRESA_Y_DIGITAL);
    const dos = toggleCanjePhoto(soloImpresa, uno.filled, 10, IMPRESA_Y_DIGITAL);
    assert.deepEqual(dos.filled, [null, null]);
  });

  it("la cruz de un lugar saca la foto sólo de ese beneficio", () => {
    assert.deepEqual(removeCanjePhotoFromBenefit(plan, [10, 10], "d", 10), [10, null]);
    assert.deepEqual(removeCanjePhotoFromBenefit(plan, [10, 10], "p", 10), [null, 10]);
  });

  it("Claudia Valenti: las 4 fotos del chico van a la carpeta y las mismas 4 a digital", () => {
    const carpeta = buildCanjeSlotPlan([
      ben({ stableKey: "c", selectionMode: "MULTI_PHOTO_FIXED", includedQuantity: 2, requiredPhotoCount: 2, name: "2× Foto grupal · 2 fotos c/u" }),
      ben({ stableKey: "d", kind: "DIGITAL", selectionMode: "MULTI_PHOTO_FIXED", includedQuantity: 2, requiredPhotoCount: 2, sortOrder: 1, name: "2 descargas · 2 fotos por descarga" }),
    ]);
    let f = emptyCanjeFill(carpeta);
    for (const id of [1, 2, 3, 4, 1, 2, 3, 4]) {
      const r = toggleCanjePhoto(carpeta, f, id, IMPRESA_Y_DIGITAL);
      assert.ok(r.ok);
      f = r.filled;
    }
    assert.ok(isCanjeComplete(f));
    assert.deepEqual(buildRedeemSelections(carpeta, f), [
      { benefitStableKey: "c", units: [[1, 2], [3, 4]] },
      { benefitStableKey: "d", units: [[1, 2], [3, 4]] },
    ]);
  });

  it("al elegir un lugar con una foto que ya está en ese beneficio, la muda", () => {
    const dos = buildCanjeSlotPlan([ben({ stableKey: "p", includedQuantity: 2, name: "Impresa" })]);
    const r = toggleCanjePhoto(dos, [10, null], 10, IMPRESA_Y_DIGITAL, 1);
    assert.deepEqual(r.filled, [null, 10]);
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

describe("lugares con nombre (foto individual y grupal)", () => {
  const librito = ben({
    name: "Librito (individual + grupal)",
    selectionMode: "MULTI_PHOTO_FIXED" as const,
    requiredPhotoCount: 2,
    photoInputs: [
      { label: "Foto individual", role: "individual" as const },
      { label: "Foto grupal", role: "group" as const },
    ],
  });

  it("cada lugar lleva el nombre del hueco de la plantilla", () => {
    const plan = buildCanjeSlotPlan([librito]);
    assert.deepEqual(
      plan.slots.map((s) => [s.label, s.role]),
      [
        ["Foto individual", "individual"],
        ["Foto grupal", "group"],
      ],
    );
  });

  it("la foto va al lugar que tocó la familia, aunque el primero esté libre", () => {
    const plan = buildCanjeSlotPlan([librito]);
    const r = toggleCanjePhoto(plan, emptyCanjeFill(plan), 77, IMPRESA_Y_DIGITAL, 1);
    assert.ok(r.ok);
    assert.deepEqual(r.filled, [null, 77]);
    // Y el armado la recibe como segunda foto de la unidad: la grupal.
    assert.deepEqual(buildRedeemSelections(plan, [10, 77]), [
      { benefitStableKey: librito.stableKey, units: [[10, 77]] },
    ]);
  });

  it("el lugar actual es el tocado o el primero libre", () => {
    assert.equal(currentCanjeSlotIndex([null, null], 1), 1);
    assert.equal(currentCanjeSlotIndex([5, null], null), 1);
    assert.equal(currentCanjeSlotIndex([5, 6], null), null);
  });

  it("para la grupal se ofrecen sólo fotos con más de 5 rostros", () => {
    const faces = new Map<number, number | null>([
      [1, 1],
      [2, 5],
      [3, 12],
      [4, null],
    ]);
    assert.deepEqual(photosForCanjeRole([1, 2, 3, 4], faces, "group"), { ids: [3], filtered: true });
    assert.deepEqual(photosForCanjeRole([1, 2, 3, 4], faces, "individual"), { ids: [1, 2, 3, 4], filtered: false });
  });

  it("si el álbum no se analizó, la grupal muestra todas", () => {
    const faces = new Map<number, number | null>([
      [1, null],
      [2, null],
    ]);
    assert.deepEqual(photosForCanjeRole([1, 2], faces, "group"), { ids: [1, 2], filtered: false });
  });
});

describe("encuadre de la vista del librito", () => {
  it("viaja con la selección, alineado con las unidades", () => {
    const plan = buildCanjeSlotPlan([
      ben({ selectionMode: "MULTI_PHOTO_FIXED" as const, requiredPhotoCount: 2 }),
    ]);
    const sel = buildRedeemSelections(plan, [10, 20], { 1: { zoom: 2, x: 0.5, y: 0 } });
    assert.deepEqual(sel[0].crops, [[null, { zoom: 2, x: 0.5, y: 0 }]]);
  });

  it("sin encuadres, la selección queda como siempre", () => {
    const plan = buildCanjeSlotPlan([ben({})]);
    assert.deepEqual(buildRedeemSelections(plan, [10]), [{ benefitStableKey: "1:benefit:1", units: [[10]] }]);
  });
});

describe("libritos con otras fotos (maestra, amigos, libre) y más de 2 fotos", () => {
  // Un librito de 4 fotos: grupal y amigos a sangre en las tapas, maestra y libre adentro. Los
  // amigos se repiten en tapa e interior (la misma foto en dos huecos).
  const hueco = (id: string, key: string, pageIndex: number) => ({
    id,
    type: "IMAGE",
    pageIndex,
    width: 1000,
    height: 800,
    configJson: { src: "", source: { variableKey: key } },
  });
  const slots = listClientPhotoSlots(
    [
      hueco("tapa-amigos", "photo_friends", 0),
      hueco("contratapa-grupal", "photo_group", 0),
      hueco("int-maestra", "photo_teacher", 1),
      hueco("int-amigos", "photo_friends", 1),
      hueco("int-libre", "photo_extra", 1),
    ],
    { photoInputs: [{ slotKey: "photo_extra", label: "Una foto que elijas" }] }
  );
  const inputs = clientPhotoInputs(slots);
  const librito = ben({
    stableKey: "L",
    name: "1× Librito",
    selectionMode: "MULTI_PHOTO_FIXED" as const,
    requiredPhotoCount: inputs.length,
    photoInputs: inputs,
  });

  it("la familia ve un lugar por foto distinta, con la etiqueta de la plantilla", () => {
    const plan = buildCanjeSlotPlan([librito]);
    assert.deepEqual(
      plan.slots.map((s) => [s.label, s.role]),
      [
        ["Foto grupal", "group"],
        ["Foto con la maestra", "teacher"],
        ["Foto con amigos", "friends"],
        ["Una foto que elijas", "extra"],
      ]
    );
  });

  it("lo que ve antes de confirmar es lo que arma el diseño final", () => {
    const plan = buildCanjeSlotPlan([librito]);
    // La familia toca primero la foto con amigos y la pone en su lugar (el 3.º).
    let filled = emptyCanjeFill(plan);
    const r = toggleCanjePhoto(plan, filled, 300, IMPRESA_Y_DIGITAL, 2);
    assert.ok(r.ok);
    filled = r.filled;
    for (const id of [100, 200, 400]) {
      const t = toggleCanjePhoto(plan, filled, id, IMPRESA_Y_DIGITAL);
      assert.ok(t.ok);
      filled = t.filled;
    }
    assert.deepEqual(filled, [100, 200, 300, 400]);
    assert.ok(isCanjeComplete(filled));

    // Vista previa del canje: cada hueco toma la foto de su lugar.
    const g = plan.groups[0];
    const lugares = placesForUnit(slots, g.slotIndexes, 0, g.photosPerUnit);
    const enVista = Object.fromEntries([...lugares].map(([blockId, place]) => [blockId, filled[place]]));

    // Diseño final: el canje manda las fotos de la unidad en orden y el armado las reparte.
    const [seleccion] = buildRedeemSelections(plan, filled);
    const armado = autoAssignClientPhotos(slots, seleccion.units[0]);
    const enDiseno = Object.fromEntries(Object.entries(armado).map(([blockId, a]) => [blockId, a.photoId]));

    assert.deepEqual(enVista, enDiseno);
    assert.deepEqual(enDiseno, {
      "contratapa-grupal": 100,
      "int-maestra": 200,
      "tapa-amigos": 300,
      "int-amigos": 300,
      "int-libre": 400,
    });
  });

  it("sólo la grupal filtra fotos por cantidad de rostros", () => {
    const faces = new Map<number, number | null>([[1, 1], [2, 12]]);
    for (const role of ["teacher", "friends", "extra"] as const) {
      assert.deepEqual(photosForCanjeRole([1, 2], faces, role), { ids: [1, 2], filtered: false });
    }
  });

  it("si el beneficio pide menos fotos que la plantilla, los huecos de más quedan sin lugar", () => {
    const corto = buildCanjeSlotPlan([{ ...librito, requiredPhotoCount: 2 }]);
    const g = corto.groups[0];
    const lugares = placesForUnit(slots, g.slotIndexes, 0, g.photosPerUnit);
    assert.deepEqual([...lugares.keys()].sort(), ["contratapa-grupal", "int-maestra"]);
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { listClientPhotoSlots } from "@repo/template-editor-core";
import {
  applyDesignV2Edit,
  buildInitialDesignData,
  emptySlotIds,
  parseDesignV2Data,
} from "./design-data";
import { resolveDesignTemplateForRedeem } from "../school-render/pick-selection-photos-for-design";
import { buildDesignValues, courseDisplayName } from "./values";

const slots = listClientPhotoSlots([
  { id: "tapa", type: "IMAGE", pageIndex: 0, width: 880, height: 1268, configJson: { source: { variableKey: "photo_1" } } },
  { id: "contra", type: "IMAGE", pageIndex: 0, width: 1200, height: 1540, configJson: { source: { variableKey: "photo_2" } } },
  { id: "grupal", type: "IMAGE", pageIndex: 1, width: 3800, height: 2500, configJson: { source: { variableKey: "photo_3" } } },
]);

const base = () =>
  buildInitialDesignData({ templateV2Id: "t", templateV2VersionId: "v", slots, photoIds: [10, 20, 30, 40] });

test("el armado inicial pone las fotos en orden y deja la cuarta en el banco", () => {
  const d = base();
  assert.equal(d.slots.tapa!.photoId, 10);
  assert.equal(d.slots.contra!.photoId, 20);
  assert.equal(d.slots.grupal!.photoId, 30);
  assert.deepEqual(d.photoIds, [10, 20, 30, 40]);
  assert.deepEqual(emptySlotIds(d), []);
});

test("cambiar una foto exige que sea del cliente y reinicia el encuadre", () => {
  const d = base();
  const conZoom = applyDesignV2Edit(d, { kind: "set-crop", blockId: "tapa", crop: { zoom: 2, x: 0.5, y: 0 } });
  assert.ok(conZoom.ok);
  const cambio = applyDesignV2Edit(conZoom.data, { kind: "set-photo", blockId: "tapa", photoId: 40 });
  assert.ok(cambio.ok);
  assert.equal(cambio.data.slots.tapa!.photoId, 40);
  assert.deepEqual(cambio.data.slots.tapa!.crop, { zoom: 1, x: 0, y: 0 });
  const ajena = applyDesignV2Edit(d, { kind: "set-photo", blockId: "tapa", photoId: 999 });
  assert.equal(ajena.ok, false);
});

test("intercambiar, quitar y volver al armado automático", () => {
  const d = base();
  const swap = applyDesignV2Edit(d, { kind: "swap", blockIdA: "tapa", blockIdB: "grupal" });
  assert.ok(swap.ok);
  assert.equal(swap.data.slots.tapa!.photoId, 30);
  assert.equal(swap.data.slots.grupal!.photoId, 10);
  const vacio = applyDesignV2Edit(swap.data, { kind: "set-photo", blockId: "contra", photoId: null });
  assert.ok(vacio.ok);
  assert.deepEqual(emptySlotIds(vacio.data), ["contra"]);
  const reset = applyDesignV2Edit(vacio.data, { kind: "reset", slots });
  assert.ok(reset.ok);
  assert.equal(reset.data.slots.tapa!.photoId, 10);
  assert.equal(reset.data.slots.contra!.photoId, 20);
});

test("cualquier cambio invalida la exportación anterior", () => {
  const d = { ...base(), export: { pdfUrl: "x.pdf", jpgUrls: [], generatedAt: "2026-10-08T00:00:00Z" } };
  const r = applyDesignV2Edit(d, { kind: "set-value", key: "student.fullName", value: "Ana" });
  assert.ok(r.ok);
  assert.equal(r.data.export, null);
  assert.equal(r.data.values["student.fullName"], "Ana");
});

test("lee lo guardado tolerando datos rotos y rechaza diseños del motor viejo", () => {
  const parsed = parseDesignV2Data({
    schemaVersion: 4,
    engine: "TEMPLATE_V2",
    templateV2Id: "t",
    templateV2VersionId: "v",
    photoIds: [1, "x", 2],
    slots: { a: { photoId: 1, crop: { zoom: 99 } }, b: { photoId: "no" } },
    values: { ok: "sí", mal: 3 },
  });
  assert.ok(parsed);
  assert.deepEqual(parsed.photoIds, [1, 2]);
  assert.equal(parsed.slots.a!.crop.zoom, 4);
  assert.equal(parsed.slots.b!.photoId, null);
  assert.deepEqual(parsed.values, { ok: "sí" });
  assert.equal(parseDesignV2Data({ schemaVersion: 3, assignments: [] }), null);
});

test("la plantilla del canje sale de los beneficios obligatorios", () => {
  const ok = resolveDesignTemplateForRedeem([
    { stableKey: "dig", sortOrder: 0, templatePolicy: "NONE" },
    { stableKey: "carpeta", sortOrder: 1, templatePolicy: "REQUIRED", templateV2Id: "tpl" },
  ]);
  assert.deepEqual(ok, { source: "PACK_REQUIRED", templateV2Id: "tpl", benefitStableKeys: ["carpeta"] });
  const falta = resolveDesignTemplateForRedeem([{ stableKey: "c", sortOrder: 0, templatePolicy: "REQUIRED" }]);
  assert.equal(falta.source, "NONE");
  const ambiguo = resolveDesignTemplateForRedeem([
    { stableKey: "a", sortOrder: 0, templatePolicy: "REQUIRED", templateV2Id: "x" },
    { stableKey: "b", sortOrder: 1, templatePolicy: "REQUIRED", templateV2Id: "y" },
  ]);
  assert.equal(ambiguo.source, "AMBIGUOUS");
});

test("los textos se arman con lo que se sabe y omiten lo vacío", () => {
  const v = buildDesignValues({
    studentName: " Juana Pérez ",
    courseName: courseDisplayName("5.º", "A"),
    schoolName: "",
    eventDate: new Date("2026-10-08T15:00:00Z"),
  });
  assert.deepEqual(v, {
    "student.fullName": "Juana Pérez",
    "course.displayName": "5.º A",
    "event.dateFormatted": "08/10/2026",
  });
});

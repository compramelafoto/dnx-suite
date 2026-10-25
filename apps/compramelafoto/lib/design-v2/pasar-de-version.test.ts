import assert from "node:assert/strict";
import { test } from "node:test";
import { listClientPhotoSlots } from "@repo/template-editor-core";
import { applyDesignV2Edit, buildInitialDesignData } from "./design-data";
import { pasarDisenoDeVersion } from "./pasar-de-version";
import { idsMarcadosDeEntrada, type DisenoAnteCambio } from "./cambio-de-plantilla-tipos";

const v1 = listClientPhotoSlots([
  { id: "tapa", type: "IMAGE", pageIndex: 0, width: 880, height: 1268, configJson: { source: { variableKey: "photo_1" } } },
  { id: "contra", type: "IMAGE", pageIndex: 0, width: 1200, height: 1540, configJson: { source: { variableKey: "photo_2" } } },
]);

function disenoArmado() {
  let d = buildInitialDesignData({
    templateV2Id: "t",
    templateV2VersionId: "v1",
    slots: v1,
    photoIds: [10, 20, 30],
    values: { "student.fullName": "Sofía Pérez" },
  });
  const r = applyDesignV2Edit(d, { kind: "set-crop", blockId: "tapa", crop: { zoom: 1.4, x: 0.2, y: -0.1 } });
  assert.ok(r.ok);
  d = r.data;
  return { ...d, export: { pdfUrl: "viejo.pdf", jpgUrls: [], generatedAt: "2026-10-01" } };
}

test("pasa el diseño a la versión nueva con la misma foto, encuadre y textos en cada hueco", () => {
  const v2 = listClientPhotoSlots([
    { id: "TAPA2", type: "IMAGE", pageIndex: 0, width: 900, height: 1300, configJson: { source: { variableKey: "photo_1" } } },
    { id: "CONTRA2", type: "IMAGE", pageIndex: 0, width: 1200, height: 1540, configJson: { source: { variableKey: "photo_2" } } },
  ]);
  const r = pasarDisenoDeVersion(disenoArmado(), {
    versionId: "v2",
    blockIdMap: { tapa: "TAPA2", contra: "CONTRA2" },
    slots: v2,
  });
  assert.ok(r.ok);
  assert.equal(r.data.templateV2VersionId, "v2");
  assert.deepEqual(r.data.slots.TAPA2, { photoId: 10, crop: { zoom: 1.4, x: 0.2, y: -0.1 } });
  assert.equal(r.data.slots.CONTRA2!.photoId, 20);
  assert.equal(r.data.values["student.fullName"], "Sofía Pérez");
  assert.deepEqual(r.data.photoIds, [10, 20, 30]);
  assert.equal(r.data.export, null, "el archivo de la versión vieja ya no sirve");
  assert.deepEqual(r.huecosNuevos, []);
});

test("un hueco nuevo en la plantilla queda vacío para completar en la revisión", () => {
  const v2 = listClientPhotoSlots([
    { id: "TAPA2", type: "IMAGE", pageIndex: 0, width: 900, height: 1300, configJson: { source: { variableKey: "photo_1" } } },
    { id: "CONTRA2", type: "IMAGE", pageIndex: 0, width: 1200, height: 1540, configJson: { source: { variableKey: "photo_2" } } },
    { id: "EXTRA", type: "IMAGE", pageIndex: 1, width: 1200, height: 1540, configJson: { source: { variableKey: "photo_3" } } },
  ]);
  const r = pasarDisenoDeVersion(disenoArmado(), { versionId: "v2", blockIdMap: { tapa: "TAPA2", contra: "CONTRA2" }, slots: v2 });
  assert.ok(r.ok);
  assert.deepEqual(r.huecosNuevos, ["EXTRA"]);
  assert.equal(r.data.slots.EXTRA!.photoId, null);
});

test("si desaparece un hueco con foto, no se pasa: necesita revisión manual", () => {
  const v2 = listClientPhotoSlots([
    { id: "TAPA2", type: "IMAGE", pageIndex: 0, width: 900, height: 1300, configJson: { source: { variableKey: "photo_1" } } },
  ]);
  const r = pasarDisenoDeVersion(disenoArmado(), { versionId: "v2", blockIdMap: { tapa: "TAPA2" }, slots: v2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.huecosPerdidos, ["contra"]);
});

test("un hueco que el bloque dejó de ser de foto del cliente cuenta como perdido", () => {
  const v2 = listClientPhotoSlots([
    { id: "TAPA2", type: "IMAGE", pageIndex: 0, width: 900, height: 1300, configJson: { source: { variableKey: "photo_1" } } },
    { id: "CONTRA2", type: "IMAGE", pageIndex: 0, width: 1200, height: 1540, configJson: { src: "logo.png" } },
  ]);
  const r = pasarDisenoDeVersion(disenoArmado(), { versionId: "v2", blockIdMap: { tapa: "TAPA2", contra: "CONTRA2" }, slots: v2 });
  assert.equal(r.ok, false);
});

test("de entrada se marcan los pendientes; los aprobados no, y el resto ni se ofrece", () => {
  const d = (id: number, categoria: DisenoAnteCambio["categoria"]): DisenoAnteCambio => ({
    id,
    quien: "x",
    status: "x",
    versionNumber: 1,
    categoria,
    motivo: null,
    huecosNuevos: 0,
  });
  assert.deepEqual(
    idsMarcadosDeEntrada([d(1, "pendiente"), d(2, "aprobado"), d(3, "produccion"), d(4, "editado-a-mano"), d(5, "pendiente")]),
    [1, 5],
  );
});

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildPreventaPackSnapshotV1 } from "./preventa-pack-snapshot-v1";

type PackRow = Parameters<typeof buildPreventaPackSnapshotV1>[0];

function beneficio(id: number, kind: "PHYSICAL" | "DIGITAL", sortOrder: number) {
  return {
    id,
    packDefinitionId: 1,
    kind,
    includedQuantity: 2,
    sortOrder,
    photographerProductId: kind === "PHYSICAL" ? 10 : null,
    templatePolicy: "NONE",
    templateId: null,
    templateV2Id: null,
    extraUnitPriceOverrideArs: null,
    regularUnitPriceAfterPreventaArs: null,
    requiredPhotoCount: 1,
    selectionMode: "SINGLE_PHOTO",
    maxPhotosPerUnit: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    template: null,
    photographerProduct: { name: "Copia impresa 15x21" },
  };
}

function pack(album: PackRow["album"]): PackRow {
  return {
    id: 1,
    albumId: 1,
    name: "Carpeta",
    description: null,
    isActive: true,
    validFrom: null,
    validUntil: null,
    redemptionDeadlineAt: null,
    displayOrder: 1,
    priceClientArs: 19130,
    currency: "ARS",
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    coverImageUrl: null,
    availabilityPhase: null,
    sourceCatalogProductId: null,
    sourceAlbumCatalogProductId: null,
    sourceCatalogSyncedAt: null,
    sourceCatalogVersionSnapshot: null,
    isRecommended: false,
    album,
    benefits: [beneficio(1, "PHYSICAL", 0), beneficio(2, "DIGITAL", 1)],
  } as unknown as PackRow;
}

test("si el álbum incluye la digital con la impresa, el impreso del pack queda con su digital", () => {
  const snap = buildPreventaPackSnapshotV1(pack({ includeDigitalWithPrint: true }), new Date(0));
  const impreso = snap.benefits.find((b) => b.kind === "PHYSICAL");
  const digital = snap.benefits.find((b) => b.kind === "DIGITAL");
  assert.equal(impreso?.includesDigital, true);
  assert.equal(digital?.includesDigital, undefined);
});

test("sin esa opción del álbum, el impreso no trae digital", () => {
  for (const album of [{ includeDigitalWithPrint: false }, null, undefined]) {
    const snap = buildPreventaPackSnapshotV1(pack(album), new Date(0));
    assert.equal(snap.benefits.find((b) => b.kind === "PHYSICAL")?.includesDigital, undefined);
  }
});

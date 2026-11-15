import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parsePreventaPackSnapshotV1,
  validateRedeemSelectionsAgainstSnapshot,
} from "./preventa-pack-snapshot-v1";

/** El pack de la carpeta escolar del álbum 1075, comprado de a dos (como el pedido 4789). */
function packDeDosCarpetas(selectionMode: "MULTI_PHOTO_FIXED" | "SINGLE_PHOTO" = "MULTI_PHOTO_FIXED") {
  return parsePreventaPackSnapshotV1({
    schemaVersion: 1,
    packDefinitionId: 88,
    packVersion: 1,
    packName: "Carpeta Escolar Impresa",
    packDescription: null,
    priceClientArs: 29998,
    currency: "ARS",
    frozenAt: "2026-10-13T16:33:51.709Z",
    redemptionDeadlineAt: null,
    benefits: [
      {
        benefitDefinitionId: 102,
        stableKey: "88:benefit:102",
        kind: "PHYSICAL",
        includedQuantity: 2,
        selectionMode,
        requiredPhotoCount: selectionMode === "SINGLE_PHOTO" ? 1 : 2,
        maxPhotosPerUnit: null,
        photographerProductId: 562,
        templatePolicy: "REQUIRED",
        templateId: null,
        extraUnitPriceOverrideArs: null,
        regularUnitPriceAfterPreventaArs: null,
        includesDigital: true,
        sortOrder: 0,
        name: "2× Carpeta escolar · 2 fotos",
        description: null,
        kindLabel: "Producto impreso",
        summary: "",
      },
    ],
  });
}

const ahora = new Date("2026-11-15T12:00:00Z");

describe("canje de varias carpetas", () => {
  it("acepta las dos carpetas con las mismas fotos", () => {
    assert.doesNotThrow(() =>
      validateRedeemSelectionsAgainstSnapshot(
        packDeDosCarpetas(),
        [{ benefitStableKey: "88:benefit:102", units: [[10, 20], [10, 20]] }],
        ahora
      )
    );
  });

  it("acepta carpetas con fotos distintas", () => {
    assert.doesNotThrow(() =>
      validateRedeemSelectionsAgainstSnapshot(
        packDeDosCarpetas(),
        [{ benefitStableKey: "88:benefit:102", units: [[10, 20], [30, 40]] }],
        ahora
      )
    );
  });

  it("dentro de una misma carpeta no se repite una foto", () => {
    assert.throws(() =>
      validateRedeemSelectionsAgainstSnapshot(
        packDeDosCarpetas(),
        [{ benefitStableKey: "88:benefit:102", units: [[10, 10], [30, 40]] }],
        ahora
      )
    );
  });

  it("en copias sueltas de una foto sigue sin repetirse", () => {
    assert.throws(() =>
      validateRedeemSelectionsAgainstSnapshot(
        packDeDosCarpetas("SINGLE_PHOTO"),
        [{ benefitStableKey: "88:benefit:102", units: [[10], [10]] }],
        ahora
      )
    );
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  PARTNER_LOGO_FAMILIES,
  PARTNER_LOGO_SLOTS,
  isPartnerLogoAssetType,
  partnerLogoSlotKey,
} from "./logo-types";
import {
  resolvePartnerLogoForSurface,
  resolvePartnerLogoSlot,
  resolvePartnerPrimaryLogo,
} from "./assets-resolve";
import type { PartnerBrandAssetRecord } from "./assets-types";

test("biblioteca: 5 familias × 3 slots = 15 archivos distintos", () => {
  assert.equal(PARTNER_LOGO_FAMILIES.length, 5);
  assert.equal(PARTNER_LOGO_SLOTS.length, 15);
  assert.ok(isPartnerLogoAssetType("LOGO_GENERAL"));
  assert.equal(partnerLogoSlotKey("LOGO_GENERAL", "COLOR"), "LOGO_GENERAL:COLOR");
  const keys = new Set(PARTNER_LOGO_SLOTS.map((s) => s.slotKey));
  assert.equal(keys.size, 15);
});

function asset(
  partial: Partial<PartnerBrandAssetRecord> &
    Pick<PartnerBrandAssetRecord, "id" | "type" | "backgroundType" | "fileUrl">,
): PartnerBrandAssetRecord {
  return {
    partnerId: "p1",
    name: partial.name ?? partial.type,
    description: null,
    storageProvider: "R2",
    storageKey: partial.storageKey ?? `key/${partial.id}`,
    mediaAssetId: null,
    originalFilename: null,
    mimeType: "image/png",
    fileExtension: "png",
    fileSize: 100,
    width: 800,
    height: 400,
    durationSeconds: null,
    aspectRatio: null,
    isPrimary: false,
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    altText: null,
    notes: null,
    metadata: null,
    uploadedById: null,
    approvedById: null,
    approvedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...partial,
  };
}

test("resolución: placa oscura usa negativo/general dark antes que color", () => {
  const assets = [
    asset({
      id: "color",
      type: "LOGO_GENERAL",
      backgroundType: "COLOR",
      fileUrl: "/api/media/color.png",
    }),
    asset({
      id: "neg",
      type: "LOGO_GENERAL",
      backgroundType: "DARK",
      fileUrl: "/api/media/neg.png",
    }),
  ];
  const dark = resolvePartnerLogoForSurface({ assets, surface: "DARK" });
  assert.equal(dark.assetId, "neg");
  const color = resolvePartnerLogoSlot({
    assets,
    type: "LOGO_GENERAL",
    backgroundType: "COLOR",
  });
  assert.equal(color.assetId, "color");
});

test("resolución: primary logo prefiere general color y cae a principal", () => {
  const onlyPrimary = [
    asset({
      id: "prim",
      type: "LOGO_PRIMARY",
      backgroundType: "COLOR",
      fileUrl: "/api/media/p.png",
    }),
  ];
  assert.equal(resolvePartnerPrimaryLogo({ assets: onlyPrimary }).assetId, "prim");

  const withGeneral = [
    ...onlyPrimary,
    asset({
      id: "gen",
      type: "LOGO_GENERAL",
      backgroundType: "COLOR",
      fileUrl: "/api/media/g.png",
    }),
  ];
  assert.equal(resolvePartnerPrimaryLogo({ assets: withGeneral }).assetId, "gen");
});

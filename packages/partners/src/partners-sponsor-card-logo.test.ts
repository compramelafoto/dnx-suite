import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSponsorCardLogoCandidates } from "./sponsor-card-logo";
import type { PartnerBrandAssetRecord } from "./assets-types";

function asset(over: Partial<PartnerBrandAssetRecord>): PartnerBrandAssetRecord {
  return {
    id: "a1",
    partnerId: "p1",
    type: "LOGO_GENERAL",
    name: "Logo",
    storageProvider: "R2",
    storageKey: null,
    fileUrl: null,
    backgroundType: "COLOR",
    isPrimary: false,
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    altText: null,
    width: null,
    height: null,
    mimeType: "image/png",
    archivedAt: null,
    ...over,
  } as PartnerBrandAssetRecord;
}

describe("resolveSponsorCardLogoCandidates", () => {
  it("sin assets ni logoUrl no devuelve candidatos", () => {
    assert.deepEqual(resolveSponsorCardLogoCandidates({ assets: [], logoUrl: null }), []);
  });

  it("usa logoUrl cuando no hay assets de marca", () => {
    const candidates = resolveSponsorCardLogoCandidates({
      assets: [],
      logoUrl: "https://cdn.io/sponsor.png",
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.url, "https://cdn.io/sponsor.png");
    assert.equal(candidates[0]!.source, "logo_url");
  });

  it("prefiere el asset de marca sobre el logoUrl suelto", () => {
    const candidates = resolveSponsorCardLogoCandidates({
      assets: [asset({ fileUrl: "https://cdn.io/brand.png" })],
      logoUrl: "https://cdn.io/suelto.png",
    });
    assert.equal(candidates[0]!.url, "https://cdn.io/brand.png");
    assert.equal(candidates[0]!.source, "brand_asset");
    assert.ok(candidates.some((c) => c.url === "https://cdn.io/suelto.png"));
  });

  it("convierte storageKey en la ruta del proxy de media", () => {
    const candidates = resolveSponsorCardLogoCandidates({
      assets: [asset({ storageKey: "clickaton/partners/logo.png" })],
      logoUrl: null,
    });
    assert.equal(candidates[0]!.url, "/api/media/clickaton/partners/logo.png");
  });

  it("ignora assets sin aprobar o archivados", () => {
    const candidates = resolveSponsorCardLogoCandidates({
      assets: [
        asset({ id: "pend", fileUrl: "https://cdn.io/pending.png", approvalStatus: "PENDING" }),
        asset({ id: "arch", fileUrl: "https://cdn.io/arch.png", archivedAt: new Date() }),
      ],
      logoUrl: "https://cdn.io/suelto.png",
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.url, "https://cdn.io/suelto.png");
  });

  it("no repite la misma URL", () => {
    const candidates = resolveSponsorCardLogoCandidates({
      assets: [asset({ fileUrl: "https://cdn.io/mismo.png" })],
      logoUrl: "https://cdn.io/mismo.png",
    });
    assert.equal(candidates.length, 1);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PartnersDomainError,
  assertPartnerUploadAllowed,
  buildPartnerBrandStorageKey,
  createMemoryPartnersRepositoryWithAudit,
  createPartnersService,
  detectPartnerFileMime,
  findBestAssetForChannel,
  resolvePartnerDisplayImage,
  resolvePartnerLogoVariant,
  resolvePartnerPrimaryLogo,
  type PartnerActor,
} from "./index";

const ops: PartnerActor = { userId: 1, isOpsAdmin: true };
const viewer: PartnerActor = { userId: 2, capabilities: ["PARTNER_ASSETS_VIEW"] };

function png1x1(): Uint8Array {
  // minimal valid PNG
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function service() {
  const repo = createMemoryPartnersRepositoryWithAudit();
  return { svc: createPartnersService(repo), repo };
}

describe("partner brand assets", () => {
  it("creates logos, sets primary, approves and resolves with logoUrl fallback", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, {
      name: "Sony",
      logoUrl: "https://cdn.example/legacy-logo.png",
    });

    const primary = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "LOGO_PRIMARY",
      name: "Logo principal",
      storageKey: "partners/x/brand/a/logo.png",
      fileUrl: "https://cdn.example/logo.png",
      mimeType: "image/png",
      width: 800,
      height: 400,
    });
    assert.equal(primary.status, "DRAFT");

    const light = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "LOGO_LIGHT",
      name: "Logo claro",
      storageKey: "partners/x/brand/b/light.png",
      fileUrl: "https://cdn.example/light.png",
    });
    const dark = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "LOGO_DARK",
      name: "Logo oscuro",
      storageKey: "partners/x/brand/c/dark.png",
      fileUrl: "https://cdn.example/dark.png",
    });
    const iso = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "ISOTYPE",
      name: "Isotipo",
      storageKey: "partners/x/brand/d/iso.png",
      fileUrl: "https://cdn.example/iso.png",
    });
    void light;
    void dark;
    void iso;

    // Antes de aprobar → fallback logoUrl
    let resolved = await svc.resolvePartnerPrimaryLogo(ops, partner.id);
    assert.equal(resolved.source, "logo_url");
    assert.equal(resolved.url, "https://cdn.example/legacy-logo.png");

    await svc.approvePartnerAsset(ops, primary.id);
    await svc.setPrimaryPartnerAsset(ops, primary.id);
    resolved = await svc.resolvePartnerPrimaryLogo(ops, partner.id);
    assert.equal(resolved.source, "brand_asset");
    assert.equal(resolved.assetId, primary.id);

    // Sin LOGO_LIGHT aprobado: cae a primary (no a logoUrl si ya hay asset usable).
    const variantFallback = await svc.resolvePartnerLogoVariant(ops, partner.id, "LOGO_LIGHT");
    assert.equal(variantFallback.source, "brand_asset");
    assert.equal(variantFallback.assetId, primary.id);
    await svc.approvePartnerAsset(ops, light.id);
    const variantOk = await svc.resolvePartnerLogoVariant(ops, partner.id, "LOGO_LIGHT");
    assert.equal(variantOk.assetId, light.id);

    const otherPrimary = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "LOGO_HORIZONTAL",
      name: "Horizontal",
      storageKey: "partners/x/brand/e/h.png",
      fileUrl: "https://cdn.example/h.png",
      isPrimary: true,
    });
    await svc.approvePartnerAsset(ops, otherPrimary.id);
    const assets = await svc.listPartnerAssets(ops, partner.id);
    assert.equal(assets.filter((a) => a.isPrimary).length, 1);
    assert.ok(assets.find((a) => a.id === otherPrimary.id)?.isPrimary);

    await svc.rejectPartnerAsset(ops, iso.id, "Baja calidad");
    await svc.requestPartnerAssetChanges(ops, dark.id, "Más contraste");
    const archived = await svc.archivePartnerAsset(ops, dark.id);
    assert.equal(archived.status, "ARCHIVED");
    assert.equal(archived.isPrimary, false);

    // Placeholder
    const orphan = await svc.createPartner(ops, { name: "Sin logo" });
    const empty = await svc.resolvePartnerDisplayImage(ops, orphan.id);
    assert.equal(empty.source, "placeholder");
  });

  it("pure resolve helpers cover logoUrl and placeholder", () => {
    assert.equal(
      resolvePartnerPrimaryLogo({ assets: [], logoUrl: "https://x/y.png" }).source,
      "logo_url",
    );
    assert.equal(resolvePartnerPrimaryLogo({ assets: [] }).source, "placeholder");
    assert.equal(
      resolvePartnerLogoVariant({ assets: [], type: "LOGO_DARK" }).source,
      "placeholder",
    );
    assert.equal(resolvePartnerDisplayImage({ assets: [] }).source, "placeholder");
  });
});

describe("participation assets", () => {
  it("creates clickaton materials, associates and filters", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Tecnoflash" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      participationType: "BENEFIT_PROVIDER",
    });
    const contribution = await svc.createContribution(ops, {
      participationId: participation.id,
      type: "PRIZE",
      title: "Kit",
    });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      participationId: participation.id,
      title: "20% reparaciones",
      description: "Desc",
      benefitType: "PERCENTAGE_DISCOUNT",
      redemptionMethod: "CONTACT_PARTNER",
    });

    const story = await svc.createParticipationAsset(ops, {
      participationId: participation.id,
      application: "CLICKATON",
      channel: "INSTAGRAM_STORY",
      assetType: "STORY",
      purpose: "EVENT_PROMOTION",
      name: "Story Clickatón",
      storageKey: "partners/p/participations/x/a/story.png",
      fileUrl: "https://cdn.example/story.png",
      width: 1080,
      height: 1920,
      orientation: "VERTICAL",
      sortOrder: 10,
    });
    const banner = await svc.createParticipationAsset(ops, {
      participationId: participation.id,
      channel: "WEB",
      assetType: "BANNER",
      name: "Banner",
      storageKey: "k",
      fileUrl: "https://cdn.example/banner.png",
      sortOrder: 20,
    });
    const video = await svc.createParticipationAsset(ops, {
      participationId: participation.id,
      channel: "INSTAGRAM_REEL",
      assetType: "REEL",
      name: "Video vertical",
      mimeType: "video/mp4",
      storageKey: "k2",
      fileUrl: "https://cdn.example/v.mp4",
      durationSeconds: 15,
    });
    const prizeImg = await svc.createParticipationAsset(
      ops,
      {
        participationId: participation.id,
        assetType: "PRIZE_IMAGE",
        purpose: "PRIZE_PROMOTION",
        name: "Cámara premio",
        contributionId: contribution.id,
        prizeBundleId: "prize-same-edition",
        storageKey: "k3",
        fileUrl: "https://cdn.example/prize.png",
      },
      { editionIdForPrize: "ed-1", prizeEditionId: "ed-1" },
    );
    const benefitImg = await svc.createParticipationAsset(ops, {
      participationId: participation.id,
      assetType: "BENEFIT_IMAGE",
      purpose: "BENEFIT_PROMOTION",
      benefitId: benefit.id,
      name: "Pieza beneficio",
      storageKey: "k4",
      fileUrl: "https://cdn.example/ben.png",
    });

    await assert.rejects(
      () =>
        svc.createParticipationAsset(
          ops,
          {
            participationId: participation.id,
            name: "Bad prize",
            prizeBundleId: "other",
            storageKey: "k",
            fileUrl: "https://cdn.example/x.png",
          },
          { editionIdForPrize: "ed-1", prizeEditionId: "ed-2" },
        ),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "VALIDATION",
    );

    await svc.approveParticipationAsset(ops, story.id);
    await svc.approveParticipationAsset(ops, banner.id);
    await svc.approveParticipationAsset(ops, video.id);
    await svc.approveParticipationAsset(ops, prizeImg.id);
    await svc.approveParticipationAsset(ops, benefitImg.id);

    const byApp = await svc.findAssetsForApplication(ops, participation.id, "CLICKATON");
    assert.ok(byApp.length >= 5);
    const byChannel = await svc.findAssetsForChannel(ops, participation.id, "INSTAGRAM_STORY");
    assert.equal(byChannel.length, 1);
    const prizes = await svc.findActivePrizeAssets(ops, "prize-same-edition");
    assert.equal(prizes.length, 1);
    const bens = await svc.findActiveBenefitAssets(ops, benefit.id);
    assert.equal(bens.length, 1);

    const expired = await svc.createParticipationAsset(ops, {
      participationId: participation.id,
      name: "Vencido",
      storageKey: "k5",
      fileUrl: "https://cdn.example/old.png",
      endsAt: new Date("2020-01-01"),
    });
    await svc.approveParticipationAsset(ops, expired.id);
    const best = await svc.findBestAssetForChannel(ops, {
      participationId: participation.id,
      channel: "INSTAGRAM_STORY",
    });
    assert.equal(best?.id, story.id);

    const rejected = await svc.createParticipationAsset(ops, {
      participationId: participation.id,
      name: "Rechazado",
      storageKey: "k6",
      fileUrl: "https://cdn.example/r.png",
      channel: "WEB",
    });
    await svc.rejectParticipationAsset(ops, rejected.id);
    const bestWeb = findBestAssetForChannel(
      await svc.listParticipationAssets(ops, {
        participationId: participation.id,
        adminList: false,
        includeRejected: false,
        includeExpired: false,
        includeArchived: false,
      }),
      { participationId: participation.id, channel: "WEB" },
    );
    assert.equal(bestWeb?.id, banner.id);

    await svc.archiveParticipationAsset(ops, video.id);
    await svc.requestParticipationAssetChanges(ops, banner.id, "Recortar");
  });
});

describe("upload security", () => {
  it("accepts png and rejects svg / path traversal / incoherent mime", () => {
    const png = png1x1();
    const ok = assertPartnerUploadAllowed({ buffer: png, declaredMime: "image/png" });
    assert.equal(ok.kind, "image");

    assert.throws(
      () =>
        assertPartnerUploadAllowed({
          buffer: new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
          declaredMime: "image/svg+xml",
        }),
      (err: unknown) => err instanceof PartnersDomainError,
    );

    assert.throws(
      () =>
        assertPartnerUploadAllowed({
          buffer: png,
          declaredMime: "application/pdf",
        }),
      (err: unknown) => err instanceof PartnersDomainError,
    );

    assert.throws(
      () => buildPartnerBrandStorageKey({ partnerId: "../x", assetId: "a", filename: "f.png" }),
      (err: unknown) => err instanceof PartnersDomainError,
    );

    assert.equal(detectPartnerFileMime(png).mime, "image/png");
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
    assert.equal(detectPartnerFileMime(gif).mime, "image/gif");
    assert.throws(
      () => assertPartnerUploadAllowed({ buffer: gif, declaredMime: "image/gif" }),
      (err: unknown) => err instanceof PartnersDomainError,
    );
  });

  it("blocks upload without capability", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Viewer Block Co" });
    await assert.rejects(
      () =>
        svc.createPartnerAsset(viewer, {
          partnerId: partner.id,
          type: "LOGO_PRIMARY",
          name: "No",
          storageKey: "k",
          fileUrl: "https://x/y.png",
        }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "FORBIDDEN",
    );
  });
});

describe("compatibility stage 01/02", () => {
  it("partner with only logoUrl still resolves and participation without payment works", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, {
      name: "Vicario",
      logoUrl: "https://cdn.example/v.png",
    });
    const display = await svc.resolvePartnerDisplayImage(ops, partner.id);
    assert.equal(display.source, "logo_url");
    const { participation, paymentSideEffects } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-legacy",
    });
    assert.equal(participation.requiresPayment, false);
    assert.equal(paymentSideEffects.createdPaymentLink, false);
  });
});

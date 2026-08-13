import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanSetWelcomeGraphicDefault,
  buildWelcomeGraphicMetadata,
  buildWelcomeGraphicProfileView,
  buildWelcomeResponsiveMediaSnapshot,
  isWelcomeGraphicAsset,
  maxBytesForWelcomeGraphic,
  parseWelcomeGraphicMetadata,
  pickWelcomeRenderUrl,
  resolveWelcomeGraphicForDevice,
  validateWelcomeGraphicAsset,
  wrapWelcomeGraphicMetadata,
  inferWelcomeCampaignSelection,
  publicWelcomeMediaForSnapshot,
  WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX,
  WELCOME_GRAPHIC_SLOTS,
  type WelcomeGraphicAssetLike,
} from "./welcome-graphic-assets";

function asset(
  partial: Partial<WelcomeGraphicAssetLike> & {
    id: string;
    device?: "DESKTOP" | "MOBILE";
    motion?: "PRIMARY" | "STATIC_FALLBACK";
    animated?: boolean;
  },
): WelcomeGraphicAssetLike {
  const device = partial.device ?? "DESKTOP";
  const motion = partial.motion ?? "PRIMARY";
  const animated = partial.animated ?? false;
  const meta = wrapWelcomeGraphicMetadata(
    buildWelcomeGraphicMetadata({
      deviceTarget: device,
      motionVariant: motion,
      animated,
      staticFallbackAssetId:
        typeof partial.metadata === "object" &&
        partial.metadata &&
        "staticFallbackAssetId" in (partial.metadata as object)
          ? ((partial.metadata as { staticFallbackAssetId?: string }).staticFallbackAssetId ??
            null)
          : null,
      isDefault: true,
    }),
  );
  return {
    id: partial.id,
    partnerId: partial.partnerId ?? "p1",
    type: partial.type ?? "BRAND_PHOTO",
    status: partial.status ?? "ACTIVE",
    approvalStatus: partial.approvalStatus ?? "APPROVED",
    archivedAt: partial.archivedAt ?? null,
    fileUrl: partial.fileUrl ?? `https://cdn.example/${partial.id}.png`,
    mimeType: partial.mimeType ?? (animated ? "image/gif" : "image/png"),
    fileSize: partial.fileSize ?? 100_000,
    width: partial.width ?? (device === "DESKTOP" ? 1200 : 1080),
    height: partial.height ?? (device === "DESKTOP" ? 630 : 1350),
    altText: partial.altText ?? `Alt ${partial.id}`,
    isPrimary: partial.isPrimary ?? false,
    metadata: partial.metadata ?? meta,
  };
}

describe("welcome graphic metadata", () => {
  it("roundtrips closed purpose/device/motion", () => {
    const meta = buildWelcomeGraphicMetadata({
      deviceTarget: "MOBILE",
      motionVariant: "STATIC_FALLBACK",
      animated: false,
    });
    const wrapped = wrapWelcomeGraphicMetadata(meta);
    const parsed = parseWelcomeGraphicMetadata(wrapped);
    assert.deepEqual(parsed, meta);
    assert.equal(WELCOME_GRAPHIC_SLOTS.length, 4);
    assert.equal(WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX, 768);
  });

  it("rejects arbitrary metadata strings", () => {
    assert.equal(parseWelcomeGraphicMetadata({ purpose: "WELCOME" }), null);
    assert.equal(
      parseWelcomeGraphicMetadata({ v: 1, purpose: "WELCOME_GRAPHIC", deviceTarget: "TABLET" }),
      null,
    );
  });
});

describe("welcome graphic validation", () => {
  it("acepta PNG desktop y rechaza SVG / otro sponsor / pending", () => {
    const ok = validateWelcomeGraphicAsset({
      asset: asset({ id: "d1", device: "DESKTOP" }),
      expectedPartnerId: "p1",
      expectedDevice: "DESKTOP",
    });
    assert.equal(ok.filter((i) => i.severity === "error").length, 0);

    const pending = validateWelcomeGraphicAsset({
      asset: asset({ id: "d2", approvalStatus: "PENDING" }),
      expectedPartnerId: "p1",
    });
    assert.ok(pending.some((i) => i.code === "ASSET_APPROVAL"));

    const foreign = validateWelcomeGraphicAsset({
      asset: asset({ id: "d3", partnerId: "other" }),
      expectedPartnerId: "p1",
    });
    assert.ok(foreign.some((i) => i.code === "ASSET_PARTNER"));

    const svg = validateWelcomeGraphicAsset({
      asset: asset({ id: "d4", fileUrl: "https://cdn.example/x.svg" }),
      expectedPartnerId: "p1",
    });
    assert.ok(svg.some((i) => i.code === "ASSET_SVG"));
  });

  it("límites GIF más estrictos en mobile", () => {
    assert.ok(
      maxBytesForWelcomeGraphic({ deviceTarget: "MOBILE", animated: true }) <
        maxBytesForWelcomeGraphic({ deviceTarget: "DESKTOP", animated: true }),
    );
    assert.ok(
      maxBytesForWelcomeGraphic({ deviceTarget: "MOBILE", animated: true }) <
        maxBytesForWelcomeGraphic({ deviceTarget: "MOBILE", animated: false }),
    );
  });
});

describe("welcome graphic resolution", () => {
  it("ambas presentes: cada device su pieza", () => {
    const desktop = asset({ id: "desk", device: "DESKTOP" });
    const mobile = asset({ id: "mob", device: "MOBILE" });
    const snap = buildWelcomeResponsiveMediaSnapshot({
      assets: [desktop, mobile],
    });
    assert.equal(snap.snapshot.desktop?.imageUrl, desktop.fileUrl);
    assert.equal(snap.snapshot.mobile?.imageUrl, mobile.fileUrl);
    assert.equal(snap.canPublish, true);
  });

  it("solo desktop → cross device warning en mobile", () => {
    const desktop = asset({ id: "desk", device: "DESKTOP" });
    const r = resolveWelcomeGraphicForDevice({
      device: "MOBILE",
      assets: [desktop],
    });
    assert.equal(r.piece?.source, "CROSS_DEVICE");
    assert.ok(r.warnings.some((w) => w.code === "CROSS_DEVICE"));
  });

  it("solo logo como fallback final", () => {
    const logo: WelcomeGraphicAssetLike = {
      id: "logo",
      partnerId: "p1",
      type: "LOGO_GENERAL",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      fileUrl: "https://cdn.example/logo.png",
      altText: "Logo",
      isPrimary: true,
      metadata: null,
    };
    const snap = buildWelcomeResponsiveMediaSnapshot({
      assets: [],
      logoAsset: logo,
    });
    assert.equal(snap.snapshot.desktop?.source, "LOGO");
    assert.equal(snap.snapshot.mobile?.source, "LOGO");
    assert.equal(snap.canPublish, true);
  });

  it("pending ignorada; selected + force logo", () => {
    const pending = asset({ id: "pend", approvalStatus: "PENDING", device: "DESKTOP" });
    const approved = asset({ id: "ok", device: "DESKTOP" });
    const r = resolveWelcomeGraphicForDevice({
      device: "DESKTOP",
      assets: [pending, approved],
      selectedPrimaryId: "pend",
    });
    assert.equal(r.piece?.imageUrl, approved.fileUrl);

    const logo = asset({
      id: "logo",
      type: "LOGO_GENERAL",
      fileUrl: "https://cdn.example/logo.png",
    });
    // logo without welcome meta
    logo.metadata = null;
    const forced = resolveWelcomeGraphicForDevice({
      device: "MOBILE",
      assets: [approved],
      forceLogo: true,
      logoAsset: logo,
    });
    assert.equal(forced.piece?.source, "LOGO");
  });

  it("perfil: cuatro slots, estados y predeterminadas sin afirmar pending visible", () => {
    const pending = asset({
      id: "pend",
      device: "DESKTOP",
      approvalStatus: "PENDING",
      metadata: wrapWelcomeGraphicMetadata(
        buildWelcomeGraphicMetadata({
          deviceTarget: "DESKTOP",
          isDefault: false,
        }),
      ),
    });
    const approvedMobile = asset({
      id: "mob",
      device: "MOBILE",
      metadata: wrapWelcomeGraphicMetadata(
        buildWelcomeGraphicMetadata({
          deviceTarget: "MOBILE",
          isDefault: true,
        }),
      ),
    });
    const logo = asset({
      id: "logo",
      type: "LOGO_GENERAL",
      fileUrl: "https://cdn.example/logo.png",
    });
    logo.metadata = null;

    const empty = buildWelcomeGraphicProfileView({ assets: [], logoAsset: logo });
    assert.equal(empty.slots.length, 4);
    assert.ok(empty.slots.every((s) => s.slotKey.startsWith("WELCOME_GRAPHIC_")));
    assert.equal(
      empty.slots.find((s) => s.slotKey === "WELCOME_GRAPHIC_DESKTOP")?.status,
      "USES_LOGO",
    );

    const mixed = buildWelcomeGraphicProfileView({
      assets: [pending, approvedMobile],
      logoAsset: logo,
    });
    const desk = mixed.slots.find((s) => s.slotKey === "WELCOME_GRAPHIC_DESKTOP")!;
    const mob = mixed.slots.find((s) => s.slotKey === "WELCOME_GRAPHIC_MOBILE")!;
    assert.equal(desk.status, "PENDING");
    assert.equal(desk.statusLabel, "Pendiente");
    assert.equal(mob.status, "APPROVED");
    assert.equal(mixed.effective.length, 2);
    // Snapshot efectivo no usa pending como pieza publicada
    assert.notEqual(mixed.snapshot.desktop?.imageUrl, pending.fileUrl);

    assert.throws(() => assertCanSetWelcomeGraphicDefault(pending));
    assert.doesNotThrow(() => assertCanSetWelcomeGraphicDefault(approvedMobile));
    const archived = asset({
      id: "arch",
      device: "DESKTOP",
      archivedAt: new Date().toISOString(),
      status: "ARCHIVED",
    });
    assert.throws(() => assertCanSetWelcomeGraphicDefault(archived));
  });

  it("inferWelcomeCampaignSelection: sin creative → defaults; logo → forceLogo", () => {
    const graphic = asset({ id: "g1", device: "DESKTOP" });
    const logo = asset({ id: "logo", type: "LOGO_GENERAL" });
    logo.metadata = null;
    const none = inferWelcomeCampaignSelection({
      creatives: [],
      assets: [graphic, logo],
      logoAssetId: logo.id,
    });
    assert.equal(none.selectedDesktopId, null);
    assert.equal(none.forceLogoDesktop, false);

    const forced = inferWelcomeCampaignSelection({
      creatives: [
        {
          format: "WELCOME_INTERSTITIAL",
          deviceTarget: "DESKTOP",
          status: "APPROVED",
          assetId: logo.id,
        },
      ],
      assets: [graphic, logo],
      logoAssetId: logo.id,
    });
    assert.equal(forced.forceLogoDesktop, true);
    assert.equal(forced.selectedDesktopId, null);

    const explicit = inferWelcomeCampaignSelection({
      creatives: [
        {
          format: "WELCOME_INTERSTITIAL",
          deviceTarget: "DESKTOP",
          status: "APPROVED",
          assetId: graphic.id,
        },
      ],
      assets: [graphic, logo],
      logoAssetId: logo.id,
    });
    assert.equal(explicit.selectedDesktopId, graphic.id);
  });

  it("GIF reduced motion usa fallback o logo; sin ambos bloquea", () => {
    const gif = asset({
      id: "gif",
      device: "DESKTOP",
      animated: true,
      mimeType: "image/gif",
      metadata: wrapWelcomeGraphicMetadata(
        buildWelcomeGraphicMetadata({
          deviceTarget: "DESKTOP",
          animated: true,
          staticFallbackAssetId: "static",
          isDefault: true,
        }),
      ),
    });
    const staticFb = asset({
      id: "static",
      device: "DESKTOP",
      motion: "STATIC_FALLBACK",
      animated: false,
    });
    const snap = buildWelcomeResponsiveMediaSnapshot({
      assets: [gif, staticFb],
    });
    assert.equal(snap.snapshot.desktop?.reducedMotionFallbackUrl, staticFb.fileUrl);
    assert.equal(snap.canPublish, true);

    const gifOnly = asset({
      id: "gif2",
      device: "MOBILE",
      animated: true,
      mimeType: "image/gif",
    });
    const blocked = buildWelcomeResponsiveMediaSnapshot({ assets: [gifOnly] });
    assert.equal(blocked.canPublish, false);
    assert.ok(blocked.warnings.some((w) => w.code === "GIF_NO_FALLBACK"));
  });

  it("legacy imageUrl compatibility", () => {
    const snap = buildWelcomeResponsiveMediaSnapshot({
      assets: [],
      legacyImageUrl: "https://cdn.example/legacy.png",
      legacyAlt: "Legacy",
    });
    assert.equal(snap.snapshot.imageUrl, "https://cdn.example/legacy.png");
    assert.equal(snap.snapshot.desktop?.source, "LEGACY_IMAGE_URL");
  });

  it("isWelcomeGraphicAsset + pickWelcomeRenderUrl", () => {
    const a = asset({ id: "x", animated: true, mimeType: "image/gif" });
    assert.equal(isWelcomeGraphicAsset(a), true);
    const piece = {
      imageUrl: a.fileUrl!,
      mimeType: "image/gif",
      width: 1200,
      height: 630,
      alt: "A",
      animated: true,
      reducedMotionFallbackUrl: "https://cdn.example/static.png",
      source: "DEFAULT" as const,
    };
    const rm = pickWelcomeRenderUrl({
      piece,
      logoFallback: null,
      reducedMotion: true,
    });
    assert.equal(rm.url, "https://cdn.example/static.png");
  });
});

describe("welcome campaign selection + snapshot público", () => {
  it("mezcla gráfica desktop + logo mobile; pending/archivada ignoradas", () => {
    const desk = asset({ id: "desk", device: "DESKTOP" });
    const archived = asset({
      id: "old",
      device: "DESKTOP",
      archivedAt: new Date("2020-01-01"),
    });
    const pendingMob = asset({ id: "pendm", device: "MOBILE", approvalStatus: "PENDING" });
    const logo: WelcomeGraphicAssetLike = {
      id: "logo1",
      partnerId: "p1",
      type: "LOGO_GENERAL",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      fileUrl: "https://cdn.example/logo.png",
      altText: "Logo",
      isPrimary: true,
      metadata: null,
    };
    const sel = inferWelcomeCampaignSelection({
      creatives: [
        {
          format: "WELCOME_INTERSTITIAL",
          deviceTarget: "DESKTOP",
          status: "APPROVED",
          assetId: "desk",
        },
        {
          format: "WELCOME_INTERSTITIAL",
          deviceTarget: "MOBILE",
          status: "APPROVED",
          assetId: "logo1",
        },
        {
          format: "WELCOME_INTERSTITIAL",
          deviceTarget: "DESKTOP",
          status: "APPROVED",
          archivedAt: new Date(),
          assetId: "old",
        },
      ],
      assets: [desk, archived, pendingMob, logo],
      logoAssetId: "logo1",
    });
    assert.equal(sel.selectedDesktopId, "desk");
    assert.equal(sel.forceLogoMobile, true);
    assert.equal(sel.forceLogoDesktop, false);

    const snap = buildWelcomeResponsiveMediaSnapshot({
      assets: [desk, archived, pendingMob, logo],
      logoAsset: logo,
      selectedDesktopId: sel.selectedDesktopId,
      selectedMobileId: sel.selectedMobileId,
      forceLogoDesktop: sel.forceLogoDesktop,
      forceLogoMobile: sel.forceLogoMobile,
    });
    assert.equal(snap.snapshot.desktop?.source, "SELECTED");
    assert.equal(snap.snapshot.mobile?.source, "LOGO");
    assert.equal(snap.canPublish, true);
    const pub = publicWelcomeMediaForSnapshot(snap.snapshot);
    assert.equal("notes" in pub, false);
    assert.equal("email" in pub, false);
    assert.ok(pub.desktop?.imageUrl);
    assert.equal(pub.mediaMinDesktopPx, 768);
  });

  it("archivada no se usa; GIF mobile con fallback; sin fallback bloquea", () => {
    const gifMob = asset({
      id: "gifm",
      device: "MOBILE",
      animated: true,
      mimeType: "image/gif",
    });
    const blocked = buildWelcomeResponsiveMediaSnapshot({ assets: [gifMob] });
    assert.equal(blocked.canPublish, false);

    const staticFb = asset({
      id: "stmob",
      device: "MOBILE",
      motion: "STATIC_FALLBACK",
    });
    const ok = buildWelcomeResponsiveMediaSnapshot({ assets: [gifMob, staticFb] });
    assert.equal(ok.snapshot.mobile?.reducedMotionFallbackUrl, staticFb.fileUrl);
    assert.equal(ok.canPublish, true);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWelcomeGraphicMetadata,
  buildWelcomeResponsiveMediaSnapshot,
  isWelcomeGraphicAsset,
  maxBytesForWelcomeGraphic,
  parseWelcomeGraphicMetadata,
  pickWelcomeRenderUrl,
  resolveWelcomeGraphicForDevice,
  validateWelcomeGraphicAsset,
  wrapWelcomeGraphicMetadata,
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

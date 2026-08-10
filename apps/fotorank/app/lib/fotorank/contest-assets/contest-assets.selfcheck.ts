import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isUsableContestAssetAlt } from "./alt";
import {
  contestAssetPublicUrl,
  sanitizeContestAssetRelativePath,
} from "./public-url";
import {
  listConnectedRelativePaths,
  resolveLocalAssetsManifest,
  withLocalAssetOverrides,
} from "./resolve-local-manifest";
import {
  SANTA_FE_EN_FOCO_ASSETS_SLUG,
  SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST,
  buildSantaFeEnFocoPresentation,
} from "./santa-fe-en-foco-assets";

/** apps/fotorank/public/contest-assets/{slug} (cwd = monorepo o app o packages/db). */
function resolveAssetsRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), "apps/fotorank/public/contest-assets", SANTA_FE_EN_FOCO_ASSETS_SLUG),
    path.resolve(process.cwd(), "public/contest-assets", SANTA_FE_EN_FOCO_ASSETS_SLUG),
    path.resolve(process.cwd(), "../../apps/fotorank/public/contest-assets", SANTA_FE_EN_FOCO_ASSETS_SLUG),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]!;
}

const publicRoot = resolveAssetsRoot();

/* Manifiesto con hero institucional conectado */
const live = buildSantaFeEnFocoPresentation();
assert.ok(live.hero.desktop);
assert.ok(live.hero.mobile);
assert.equal(live.identity.organizerLogo, null);
assert.equal(live.gallery.length, 0);
assert.ok(live.social);
assert.ok(listConnectedRelativePaths(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST).length >= 2);

/* Alt */
assert.equal(isUsableContestAssetAlt("imagen"), false);
assert.equal(isUsableContestAssetAlt("hero"), false);
assert.equal(isUsableContestAssetAlt("hero-desktop.webp", "hero/hero-desktop.webp"), false);
assert.equal(isUsableContestAssetAlt("Fotografía del litoral santafesino al atardecer"), true);

/* URL local */
assert.equal(
  contestAssetPublicUrl("santa-fe-en-foco", "hero/hero-desktop.webp"),
  "/contest-assets/santa-fe-en-foco/hero/hero-desktop.webp",
);
assert.equal(sanitizeContestAssetRelativePath("../secret.png"), null);
assert.equal(sanitizeContestAssetRelativePath("hero/hero.svg"), null);

/* Asset inexistente (fileExists false) → no se incluye */
const missing = resolveLocalAssetsManifest(
  withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
    heroDesktopFile: "hero/hero-desktop.webp",
  }),
  { fileExists: () => false },
);
assert.equal(missing.hero.desktop, null);

/* Hero solo desktop */
const desktopOnly = resolveLocalAssetsManifest(
  withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
    heroDesktopFile: "hero/hero-desktop.webp",
    heroMobileFile: null,
    socialFile: null,
  }),
  { fileExists: (_s, p) => p === "hero/hero-desktop.webp" },
);
assert.ok(desktopOnly.hero.desktop);
assert.equal(desktopOnly.hero.mobile, null);
assert.equal(desktopOnly.hero.desktop?.focalPointY, 45);

/* Hero desktop + mobile */
const both = resolveLocalAssetsManifest(
  withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
    heroDesktopFile: "hero/hero-desktop.webp",
    heroMobileFile: "hero/hero-mobile.webp",
  }),
  {
    fileExists: (_s, p) =>
      p === "hero/hero-desktop.webp" || p === "hero/hero-mobile.webp",
  },
);
assert.ok(both.hero.desktop);
assert.ok(both.hero.mobile);

/* Logo ausente */
assert.equal(
  resolveLocalAssetsManifest(
    withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
      organizerLogoFile: null,
    }),
  ).identity.organizerLogo,
  null,
);

/* Galería vacía vs con imágenes + orden */
const galEmpty = resolveLocalAssetsManifest(
  withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
    socialFile: null,
  }),
);
assert.equal(galEmpty.gallery.length, 0);

const galManifest = withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
  gallery: [
    {
      order: 3,
      file: "gallery/gallery-03.webp",
      alt: "Tercera fotografía institucional de Santa Fe en Foco",
    },
    {
      order: 1,
      file: "gallery/gallery-01.webp",
      alt: "Primera fotografía institucional de Santa Fe en Foco",
    },
    {
      order: 2,
      file: "gallery/gallery-02.webp",
      alt: "Segunda fotografía institucional de Santa Fe en Foco",
    },
  ],
});
const gal = resolveLocalAssetsManifest(galManifest, { fileExists: () => true });
assert.equal(gal.gallery.length, 3);
assert.ok(gal.gallery[0]?.url.endsWith("gallery-01.webp"));
assert.ok(gal.gallery[2]?.url.endsWith("gallery-03.webp"));

/* Alt ausente / inválido → rechazo */
const badAlt = resolveLocalAssetsManifest(
  {
    ...SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST,
    hero: {
      ...SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.hero,
      desktop: { file: "hero/hero-desktop.webp", alt: "foto" },
    },
  },
  { fileExists: () => true },
);
assert.equal(badAlt.hero.desktop, null);

/* Social del manifiesto actual apunta al banner hero */
assert.ok(buildSantaFeEnFocoPresentation().social?.url.includes("hero-desktop.jpg"));
const withSocial = resolveLocalAssetsManifest(
  withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
    socialFile: "social/social-cover.webp",
  }),
  { fileExists: () => true },
);
assert.ok(withSocial.social?.url.includes("social-cover.webp"));

/* Archivos conectados en disco deben existir */
for (const relative of listConnectedRelativePaths(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST)) {
  const abs = path.join(publicRoot, relative);
  assert.ok(fs.existsSync(abs), `manifiesto apunta a archivo inexistente: ${relative}`);
}

console.log("contest-assets.selfcheck: OK");

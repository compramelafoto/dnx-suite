import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

/**
 * apps/fotorank/public/contest-assets/{slug}, resuelto desde la ubicación de
 * ESTE archivo y no desde `process.cwd()`: el runner lo ejecuta con cwd en
 * `packages/db`, donde ninguno de los candidatos relativos existía. Mientras el
 * manifiesto no tenía assets conectados el bucle final iteraba cero veces y el
 * error quedaba oculto; al conectarse el hero pasó a importar de verdad.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(
  HERE,
  "../../../../public/contest-assets",
  SANTA_FE_EN_FOCO_ASSETS_SLUG,
);

/**
 * Manifiesto desconectado: todo `file: null`.
 *
 * Antes esto se probaba sobre el manifiesto real de Santa Fe en Foco, que en
 * ese momento no tenía ningún asset conectado. Cuando `fa4ae164` conectó los
 * JPG del hero —un cambio funcional legítimo, que arregla la regresión de
 * `615df551`, cuando el header desapareció en producción— estos asserts
 * empezaron a fallar sin que hubiera nada roto.
 *
 * La intención original que sí importa conservar es "un asset sin material
 * resuelve a null, no a una URL rota". Eso ahora se verifica contra un
 * manifiesto explícitamente vacío, así el test comprueba el comportamiento del
 * resolver y no una foto del contenido del manifiesto en una fecha dada.
 */
const DISCONNECTED = {
  ...SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST,
  hero: {
    ...SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.hero,
    desktop: { ...SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.hero.desktop, file: null },
    mobile: { ...SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.hero.mobile, file: null },
  },
};

const empty = resolveLocalAssetsManifest(DISCONNECTED);
assert.equal(empty.hero.desktop, null);
assert.equal(empty.hero.mobile, null);
assert.equal(empty.identity.organizerLogo, null);
assert.equal(empty.gallery.length, 0);
assert.equal(empty.social, null);
assert.equal(listConnectedRelativePaths(DISCONNECTED).length, 0);

/**
 * Y el contrapunto: el manifiesto REAL sí tiene el hero conectado. Si alguien
 * lo vuelve a dejar en `null`, el header de SFEF desaparece de producción —
 * exactamente lo que pasó en `615df551`.
 */
const real = buildSantaFeEnFocoPresentation({ fileExists: () => true });
assert.ok(real.hero.desktop, "el manifiesto real de SFEF mantiene el hero desktop conectado");
assert.ok(real.hero.mobile, "el manifiesto real de SFEF mantiene el hero mobile conectado");

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
  }),
  { fileExists: (_s, p) => p === "hero/hero-desktop.webp" },
);
assert.ok(desktopOnly.hero.desktop);
assert.equal(desktopOnly.hero.mobile, null);
/**
 * El focal point del manifiesto se propaga y NO se pierde contra el default 50.
 * Se compara contra el manifiesto y no contra un número literal: antes estaba
 * fijado a 42 y quedó desactualizado en cuanto se reencuadró el hero real.
 */
assert.equal(
  desktopOnly.hero.desktop?.focalPointY,
  SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.hero.desktop.focalPointY,
);

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
const galEmpty = resolveLocalAssetsManifest(DISCONNECTED);
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

/* Social fallback */
assert.equal(buildSantaFeEnFocoPresentation().social, null);
const withSocial = resolveLocalAssetsManifest(
  withLocalAssetOverrides(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, {
    socialFile: "social/social-cover.webp",
  }),
  { fileExists: () => true },
);
assert.ok(withSocial.social?.url.includes("social-cover.webp"));

/**
 * Todo archivo conectado en el manifiesto debe existir en disco. Hoy son los
 * dos JPG del hero: si el manifiesto apuntara a un archivo que no llegó a la
 * rama desplegada, el hero quedaría en 404 en producción.
 */
const conectados = listConnectedRelativePaths(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST);
assert.ok(conectados.length > 0, "el manifiesto real debe tener al menos un asset conectado");
for (const relative of conectados) {
  const abs = path.join(publicRoot, relative);
  assert.ok(fs.existsSync(abs), `manifiesto apunta a archivo inexistente: ${relative}`);
}

console.log("contest-assets.selfcheck: OK");

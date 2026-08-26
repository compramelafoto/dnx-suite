import type { ContestVisualPresentation } from "../contest-visual/presentation";
import { resolveLocalAssetsManifest } from "./resolve-local-manifest";
import type { ContestLocalAssetsManifest } from "./types";

export const SANTA_FE_EN_FOCO_ASSETS_SLUG = "santa-fe-en-foco";

/**
 * Rutas canónicas recomendadas bajo
 * `public/contest-assets/santa-fe-en-foco/`.
 * Extensión flexible (webp/jpg/png) al conectar en el manifiesto.
 */
export const SANTA_FE_EN_FOCO_CANONICAL_PATHS = {
  heroDesktop: "hero/hero-desktop.webp",
  heroMobile: "hero/hero-mobile.webp",
  contestLogo: "identity/contest-logo.png",
  organizerLogo: "identity/organizer-logo.png",
  secondarySenado: "identity/logos-secondary/senado.png",
  overview: "editorial/overview.webp",
  categories: "editorial/categories.webp",
  participation: "editorial/participation.webp",
  organizer: "editorial/organizer.webp",
  prizes: "editorial/prizes.webp",
  social: "social/social-cover.webp",
  gallery: (n: number) => `gallery/gallery-${String(n).padStart(2, "0")}.webp`,
} as const;

/**
 * Manifiesto operativo Santa Fe en Foco.
 * `file: null` = asset pendiente / no conectar (fallback tipográfico).
 *
 * Para activar un asset oficial:
 * 1. Colocar el archivo en la ruta canónica.
 * 2. Setear `file` a esa ruta relativa.
 * 3. Ajustar alt / focal / crédito.
 * 4. Ejecutar `node apps/fotorank/scripts/validate-santa-fe-visual-assets.mjs`.
 *
 * No hardcodear URLs en ContestPublicLanding.
 */
export const SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST: ContestLocalAssetsManifest = {
  slug: SANTA_FE_EN_FOCO_ASSETS_SLUG,
  hero: {
    desktop: {
      file: null,
      alt: "Fotografía representativa del concurso Santa Fe en Foco",
      focalPointX: 50,
      focalPointY: 42,
      orientation: "landscape",
    },
    mobile: {
      file: null,
      alt: "Fotografía representativa del concurso Santa Fe en Foco (versión móvil)",
      focalPointX: 50,
      focalPointY: 40,
      orientation: "portrait",
    },
    overlayStrength: "medium",
    minimumHeightPreset: "standard",
    textAlignment: "start",
    contentPosition: "bottom",
  },
  identity: {
    contestLogo: {
      file: null,
      alt: "Logo del concurso Santa Fe en Foco",
    },
    organizerLogo: {
      file: null,
      alt: "Logo de la Sociedad de Fotógrafos Profesionales de Rosario",
    },
    secondaryLogos: [
      {
        file: null,
        alt: "Logo de la Cámara de Senadores de la Provincia de Santa Fe",
      },
    ],
    logoPresentationPreset: "mark",
  },
  editorial: {
    overview: {
      file: null,
      alt: "Imagen editorial de presentación de Santa Fe en Foco",
      focalPointX: 50,
      focalPointY: 50,
      orientation: "landscape",
    },
    categories: {
      file: null,
      alt: "Imagen de apoyo a las categorías del concurso Santa Fe en Foco",
      orientation: "landscape",
    },
    participation: {
      file: null,
      alt: "Imagen de apoyo al proceso de participación en Santa Fe en Foco",
      orientation: "landscape",
    },
    organizer: {
      file: null,
      alt: "Imagen institucional de la organización de Santa Fe en Foco",
      orientation: "landscape",
    },
    prizes: {
      file: null,
      alt: "Imagen de apoyo a premios y reconocimientos de Santa Fe en Foco",
      orientation: "landscape",
    },
  },
  gallery: [
    {
      order: 1,
      file: null,
      alt: "Fotografía institucional del concurso Santa Fe en Foco, pieza 1",
    },
    {
      order: 2,
      file: null,
      alt: "Fotografía institucional del concurso Santa Fe en Foco, pieza 2",
    },
    {
      order: 3,
      file: null,
      alt: "Fotografía institucional del concurso Santa Fe en Foco, pieza 3",
    },
  ],
  social: {
    file: null,
    alt: "Imagen para compartir Santa Fe en Foco en redes sociales",
    orientation: "landscape",
  },
  onHeroForegroundColor: "#fafafa",
  onHeroMutedColor: "#e4e4e7",
};

/** Presentación resuelta desde el manifiesto (solo files no nulos). */
export function buildSantaFeEnFocoPresentation(
  options?: Parameters<typeof resolveLocalAssetsManifest>[1],
): ContestVisualPresentation {
  return resolveLocalAssetsManifest(SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST, options);
}

import { brandAssetPaths } from "@/config/brand-assets";

/**
 * Configuración central de marca — Clickatón.
 */

export const siteConfig = {
  name: "Clickatón",
  nameFull: "Clickatón — Maratón Fotográfica Internacional",
  wordmark: "CLICKATÓN!",
  descriptor: "Maratón Fotográfica Internacional",
  description:
    "Una experiencia de fotografía, creatividad, aprendizaje y comunidad que transforma cada ciudad en un nuevo desafío.",
  /** Dominio público confirmado (Vercel). */
  url: "https://maratonfotografica.com",
  tagline: "Cada Clickatón te ayuda a mirar mejor.",
  promise: "Cada Clickatón te ayuda a mirar mejor.",
  editorialLine: "Salí a buscar el instante.",
  contactEmail: "" as string,
  social: {
    instagram: "https://www.instagram.com/clickaton.ok/",
    facebook: "" as string,
    youtube: "" as string,
    tiktok: "" as string,
  },
  brandAssets: {
    status: "official" as const,
    favicon: "/favicon.png",
    appleTouchIcon: "/apple-touch-icon.png",
    ogImage: "/og-default.png",
    favicon32: brandAssetPaths.favicon32,
    socialAvatar: brandAssetPaths.socialAvatar,
    ogDefaultBrand: brandAssetPaths.ogDefault,
  },
  copyrightOwner: "Clickatón",
} as const;

export type SiteConfig = typeof siteConfig;

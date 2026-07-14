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
    instagram: "" as string,
    facebook: "" as string,
    youtube: "" as string,
    tiktok: "" as string,
  },
  brandAssets: {
    status: "official" as const,
    favicon: "/favicon.png",
    appleTouchIcon: "/apple-touch-icon.png",
    ogImage: "/og-default.png",
    socialAvatar: "/brand/social-avatar.png",
  },
  copyrightOwner: "Clickatón",
} as const;

export type SiteConfig = typeof siteConfig;

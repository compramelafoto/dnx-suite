/**
 * Configuración central de marca — Clickaton.
 */

export const siteConfig = {
  name: "Clickaton",
  nameFull: "Clickaton — Maratón Fotográfica Internacional",
  wordmark: "CLICKATON!",
  descriptor: "Maratón Fotográfica Internacional",
  description:
    "Una experiencia de fotografía, creatividad, aprendizaje y comunidad que transforma cada ciudad en un nuevo desafío.",
  /** Dominio público confirmado (Vercel). */
  url: "https://maratonfotografica.com",
  tagline: "Cada Clickaton te ayuda a mirar mejor.",
  promise: "Cada Clickaton te ayuda a mirar mejor.",
  editorialLine: "Salí a buscar el instante.",
  contactEmail: "" as string,
  social: {
    instagram: "" as string,
    facebook: "" as string,
    youtube: "" as string,
    tiktok: "" as string,
  },
  /** Recursos de marca oficiales aún no disponibles. */
  brandAssets: {
    status: "provisional" as const,
    note:
      "Usar wordmark tipográfico hasta reemplazar por logos oficiales en /public/brand/.",
  },
  copyrightOwner: "Clickaton",
} as const;

export type SiteConfig = typeof siteConfig;

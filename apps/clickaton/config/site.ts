/**
 * Configuración central de marca — Clickaton.
 */

export const siteConfig = {
  name: "Clickaton",
  nameFull: "Clickaton — Maratón Fotográfica Internacional",
  wordmark: "CLICKATON!",
  descriptor: "Maratón Fotográfica Internacional",
  description:
    "Una experiencia fotográfica de creatividad, aprendizaje y comunidad.",
  /** Dominio público confirmado (Vercel). */
  url: "https://maratonfotografica.com",
  tagline: "Cada Clickaton te convierte en un mejor fotógrafo.",
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

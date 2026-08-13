/**
 * Constantes públicas del Slider de marcas FotoRank (client-safe).
 */
export const FOTORANK_HOME_MARQUEE_PLACEMENT = "FOTORANK_HOME_MARQUEE" as const;
export const FOTORANK_CONTEST_MARQUEE_PLACEMENT = "FOTORANK_CONTEST_MARQUEE" as const;

export const FOTORANK_HOME_MARQUEE_TITLE = "Marcas que nos acompañan";
export const FOTORANK_CONTEST_MARQUEE_TITLE = "Sponsors del concurso";

export type FotorankMarqueePublicItem = {
  campaignId: string;
  creativeId: string;
  partnerName: string;
  logoUrl: string | null;
  alt: string | null;
  href: string | null;
};

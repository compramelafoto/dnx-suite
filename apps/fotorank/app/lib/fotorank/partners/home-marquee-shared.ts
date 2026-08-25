/**
 * Constantes públicas del Slider de marcas FotoRank (client-safe).
 *
 * Es inventario **global** de la plataforma: no pertenece a ningún concurso.
 * Esa distinción importa comercialmente — un organizador vende su concurso,
 * pero la portada la vende DNX.
 */
export const FOTORANK_HOME_MARQUEE_PLACEMENT = "FOTORANK_HOME_MARQUEE" as const;

export const FOTORANK_HOME_MARQUEE_TITLE = "Marcas que nos acompañan";

export type FotorankMarqueePublicItem = {
  campaignId: string;
  creativeId: string;
  partnerName: string;
  logoUrl: string | null;
  alt: string | null;
  href: string | null;
};

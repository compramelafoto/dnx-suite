/**
 * Contratos públicos CLF ALBUM welcome (seguros para Client Components).
 */
export const CLF_ALBUM_WELCOME_PLACEMENT = "CLF_ALBUM_WELCOME" as const;

/** Mismo delay que FotoRank / Clickatón (1000 ms). */
export const CLF_ALBUM_WELCOME_APPEAR_DELAY_MS = 1000;

export type ClfAlbumWelcomePublicPayload = {
  campaignId: string;
  partnerName: string;
  creativeId: string;
  imageUrl: string | null;
  href: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
};

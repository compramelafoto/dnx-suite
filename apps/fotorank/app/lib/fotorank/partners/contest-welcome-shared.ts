/**
 * Contratos públicos FotoRank CONTEST welcome (seguros para Client Components).
 */
export const FOTORANK_CONTEST_WELCOME_PLACEMENT = "FOTORANK_CONTEST_WELCOME" as const;

/** Mismo delay que Clickatón EVENT (1000 ms). */
export const FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS = 1000;

export type FotorankContestWelcomePublicPayload = {
  campaignId: string;
  partnerName: string;
  creativeId: string;
  imageUrl: string | null;
  href: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
};

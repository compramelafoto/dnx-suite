/**
 * Contratos públicos FotoRank CONTEST welcome (seguros para Client Components).
 */
export const FOTORANK_CONTEST_WELCOME_PLACEMENT = "FOTORANK_CONTEST_WELCOME" as const;

/** Mismo delay que Clickatón EVENT (1000 ms). */
export const FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS = 1000;

export type WelcomePublicMediaSnapshot = {
  imageUrl?: string | null;
  desktop?: {
    imageUrl: string;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
    alt: string;
    animated: boolean;
    reducedMotionFallbackUrl?: string | null;
    source?: string;
  } | null;
  mobile?: WelcomePublicMediaSnapshot["desktop"];
  logoFallback?: WelcomePublicMediaSnapshot["desktop"];
  mediaMinDesktopPx?: number;
};

export type FotorankContestWelcomePublicPayload = {
  campaignId: string;
  partnerName: string;
  creativeId: string;
  imageUrl: string | null;
  href: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  welcomeMedia?: WelcomePublicMediaSnapshot | null;
};

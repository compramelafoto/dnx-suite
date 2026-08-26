/**
 * Contratos públicos Clickatón EVENT welcome (seguros para Client Components).
 * Sin Prisma / headers / server-only.
 */

export const CLICKATON_EVENT_WELCOME_PLACEMENT = "CLICKATON_EVENT_WELCOME" as const;

/** Delay cliente antes de abrir (ms). */
export const CLICKATON_EVENT_WELCOME_APPEAR_DELAY_MS = 1000;

/** Solo datos públicos hacia el client wrapper. */
export type ClickatonEventWelcomePublicPayload = {
  campaignId: string;
  partnerName: string;
  creativeId: string;
  imageUrl: string | null;
  href: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
};

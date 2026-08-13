/**
 * Constantes públicas del Slider de marcas Clickatón (client-safe).
 */
export const CLICKATON_HOME_MARQUEE_PLACEMENT = "CLICKATON_HOME_MARQUEE" as const;
export const CLICKATON_EVENT_MARQUEE_PLACEMENT = "CLICKATON_EVENT_MARQUEE" as const;

export const CLICKATON_HOME_MARQUEE_TITLE = "Marcas que nos acompañan";
export const CLICKATON_EVENT_MARQUEE_TITLE = "Sponsors del evento";

export type ClickatonMarqueePublicItem = {
  campaignId: string;
  creativeId: string;
  partnerName: string;
  logoUrl: string | null;
  alt: string | null;
  href: string | null;
};

/**
 * Copy / CTA de inscripción pública (Etapa 09A).
 * No calcula precios ni estados: solo presenta el bloque `registration`.
 */

import { displayPriceLabel } from "@/lib/money";
import type { PublicRegistrationSummary } from "@/types/public";

export type RegistrationCtaPresentation = {
  headline: string;
  secondaryLine: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaEnabled: boolean;
};

export function presentRegistrationCta(
  registration: PublicRegistrationSummary | null | undefined,
): RegistrationCtaPresentation {
  if (!registration) {
    return {
      headline: "Inscripción no disponible",
      secondaryLine: null,
      ctaLabel: null,
      ctaHref: null,
      ctaEnabled: false,
    };
  }

  const priceLabel = displayPriceLabel(registration.displayPrice);
  const merch =
    registration.hasOptionalMerchandise
      ? "Merchandising opcional disponible"
      : null;

  switch (registration.status) {
    case "not_open":
      return {
        headline: "Inscripciones próximamente",
        secondaryLine: merch,
        ctaLabel: null,
        ctaHref: null,
        ctaEnabled: false,
      };
    case "closed":
      return {
        headline: "Inscripción cerrada",
        secondaryLine: null,
        ctaLabel: null,
        ctaHref: null,
        ctaEnabled: false,
      };
    case "full":
      return {
        headline: "Cupos completos",
        secondaryLine: null,
        ctaLabel: null,
        ctaHref: null,
        ctaEnabled: false,
      };
    case "cancelled":
      return {
        headline: "Evento cancelado",
        secondaryLine: null,
        ctaLabel: null,
        ctaHref: null,
        ctaEnabled: false,
      };
    case "finished":
      return {
        headline: "Edición finalizada",
        secondaryLine: null,
        ctaLabel: null,
        ctaHref: null,
        ctaEnabled: false,
      };
    case "open": {
      const headline =
        registration.mode === "free"
          ? "Inscripción gratuita"
          : priceLabel
            ? `Inscripción: ${priceLabel}`
            : "Inscripción paga";
      // 09B1: solo handoff informativo a FotoRank. checkoutUrl queda null hasta 09B2/DNX Payments.
      const href =
        registration.canRegister
          ? registration.registrationUrl ?? null
          : null;
      return {
        headline,
        secondaryLine: merch,
        ctaLabel: href ? "Inscribirme" : null,
        ctaHref: href,
        ctaEnabled: Boolean(href),
      };
    }
    default:
      return {
        headline: "Inscripción no disponible",
        secondaryLine: null,
        ctaLabel: null,
        ctaHref: null,
        ctaEnabled: false,
      };
  }
}

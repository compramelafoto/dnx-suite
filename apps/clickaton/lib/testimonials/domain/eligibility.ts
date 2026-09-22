/**
 * Quién puede dejar un testimonio de una edición, y con qué identidad.
 *
 * La identidad NO sale del formulario: sale de lo que ya está guardado
 * (la inscripción, la sede o el padrón de jurados). Lo único que escribe el
 * autor es su texto y, opcionalmente, un enlace propio.
 */
import type { ClickatonTestimonialAuthorRole } from "./types";

export type EligibilityFacts = {
  confirmedRegistration: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoAssetId: string | null;
    instagramUrl: string | null;
  } | null;
  venue: { id: string; name: string } | null;
  juror: { name: string; photoAssetId: string | null } | null;
  emailVerified: boolean;
  /**
   * El vínculo se encontró sólo cruzando el correo de la sesión, sin un
   * `userId` que lo respalde. Poder leer un correo no alcanza para escribir
   * en nombre de quien lo tiene.
   */
  matchedByEmailOnly: boolean;
};

export type EligibilityDenialReason = "NO_ROLE" | "EMAIL_NOT_VERIFIED";

export type Eligibility =
  | {
      eligible: true;
      role: ClickatonTestimonialAuthorRole;
      authorName: string;
      authorPhotoAssetId: string | null;
      suggestedLinkUrl: string | null;
      registrationId: string | null;
      venueId: string | null;
    }
  | { eligible: false; reason: EligibilityDenialReason };

export type EligibleAuthor = Extract<Eligibility, { eligible: true }>;

function fullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function resolveEligibility(facts: EligibilityFacts): Eligibility {
  const hasAnyRole =
    facts.confirmedRegistration !== null ||
    facts.venue !== null ||
    facts.juror !== null;

  if (!hasAnyRole) return { eligible: false, reason: "NO_ROLE" };

  if (facts.matchedByEmailOnly && !facts.emailVerified) {
    return { eligible: false, reason: "EMAIL_NOT_VERIFIED" };
  }

  // El participante manda: es el rol con la identidad más completa y el que
  // más peso tiene en un testimonio público.
  if (facts.confirmedRegistration) {
    const reg = facts.confirmedRegistration;
    return {
      eligible: true,
      role: "PARTICIPANT",
      authorName: fullName(reg.firstName, reg.lastName),
      authorPhotoAssetId: reg.profilePhotoAssetId,
      suggestedLinkUrl: reg.instagramUrl,
      registrationId: reg.id,
      venueId: null,
    };
  }

  if (facts.juror) {
    return {
      eligible: true,
      role: "JUROR",
      authorName: facts.juror.name.trim(),
      authorPhotoAssetId: facts.juror.photoAssetId,
      suggestedLinkUrl: null,
      registrationId: null,
      venueId: null,
    };
  }

  const venue = facts.venue!;
  return {
    eligible: true,
    role: "VENUE",
    authorName: venue.name.trim(),
    authorPhotoAssetId: null,
    suggestedLinkUrl: null,
    registrationId: null,
    venueId: venue.id,
  };
}

export const ELIGIBILITY_DENIAL_COPY: Record<EligibilityDenialReason, string> = {
  NO_ROLE:
    "Esta encuesta es para quienes participaron de esta edición. No encontramos tu inscripción confirmada con esta cuenta.",
  EMAIL_NOT_VERIFIED:
    "Encontramos tu inscripción por tu correo, pero todavía no lo verificaste. Verificá tu correo y volvé a entrar.",
};

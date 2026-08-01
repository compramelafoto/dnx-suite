import type { ParticipantCardConsentInput } from "./participant-card-types";

/**
 * Proxy de consentimiento para placas de participante.
 *
 * No existe un flag específico de "consentimiento de placa". Usamos como proxy:
 * - imageUsageConsent === true
 * - acceptedImageAt != null
 * - termsAcceptedAt / acceptedTermsAt != null
 *
 * Cualquiera de estos indica que el participante aceptó uso de imagen o bases.
 */
export function hasClickatonCardConsent(registration: ParticipantCardConsentInput): boolean {
  if (registration.imageUsageConsent === true) return true;
  if (registration.acceptedImageAt != null) return true;
  if (registration.termsAcceptedAt != null) return true;
  if (registration.acceptedTermsAt != null) return true;
  return false;
}

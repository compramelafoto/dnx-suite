/**
 * De tres casillas a cuatro campos de base.
 *
 * Reglas duras del diseño:
 * - La casilla del mapa público exige la personal y la mayoría de edad.
 * - Un menor nunca queda con locationPublicConsentAt, aunque marque todo.
 * - Un consentimiento ya otorgado conserva su fecha original: la fecha dice
 *   cuándo consintió, no cuándo se guardó por última vez.
 * - Desmarcar una casilla revoca (deja la fecha en null).
 */
import { evaluateMinorGate } from "@/lib/rules-2026/minors";

import { CLICKATON_LOCATION_CONSENT_VERSION } from "../content/location-consent-copy";

export type LocationConsentChoices = {
  /** Usar mi ubicación para mis estadísticas personales. */
  personal: boolean;
  /** Aparecer en el mapa público y en la transmisión. */
  publicMap: boolean;
  /** Que el equipo de transmisión me contacte. */
  interview: boolean;
  /** Declaración de mayoría de edad, incrustada en la casilla del mapa. */
  declaredAdult: boolean;
};

export type LocationConsentFields = {
  locationConsentAt: Date | null;
  locationPublicConsentAt: Date | null;
  interviewConsentAt: Date | null;
  locationConsentVersion: string | null;
};

export function resolveLocationConsent(input: {
  choices: LocationConsentChoices;
  birthDate: Date | null;
  eventDate: Date;
  now: Date;
  previous?: LocationConsentFields;
}): LocationConsentFields {
  const { choices, now, previous } = input;

  const gate = evaluateMinorGate({
    birthDate: input.birthDate,
    eventDate: input.eventDate,
  });
  const isMinor = gate.ok === false || gate.isMinor === true;

  const personal = choices.personal;
  const publicMap =
    choices.publicMap && personal && choices.declaredAdult && !isMinor;
  const interview = choices.interview;

  const keep = (granted: boolean, before: Date | null | undefined) =>
    granted ? (before ?? now) : null;

  const fields: LocationConsentFields = {
    locationConsentAt: keep(personal, previous?.locationConsentAt),
    locationPublicConsentAt: keep(publicMap, previous?.locationPublicConsentAt),
    interviewConsentAt: keep(interview, previous?.interviewConsentAt),
    locationConsentVersion: null,
  };

  const alguno =
    fields.locationConsentAt !== null ||
    fields.locationPublicConsentAt !== null ||
    fields.interviewConsentAt !== null;

  fields.locationConsentVersion = alguno
    ? CLICKATON_LOCATION_CONSENT_VERSION
    : null;

  return fields;
}

/**
 * De tres casillas a cuatro campos de base (más la declaración de mayoría
 * de edad, que es pegajosa y no un consentimiento en sí).
 *
 * Reglas duras del diseño (§5.2):
 * - La casilla del mapa público exige la personal y la mayoría de edad.
 * - Un menor nunca queda con locationPublicConsentAt, aunque marque todo.
 * - Un menor SIN autorización del adulto responsable no obtiene ninguna de
 *   las tres casillas: "Las casillas 1 y 3 requieren el consentimiento del
 *   adulto responsable."
 * - Un menor CON autorización del adulto responsable sí puede otorgar la 1
 *   (personal) y la 3 (entrevista); la 2 (mapa público) nunca.
 * - Un consentimiento ya otorgado conserva su fecha original: la fecha dice
 *   cuándo consintió, no cuándo se guardó por última vez — salvo que cambió
 *   la versión del texto legal, en cuyo caso la fecha se renueva: no se
 *   puede afirmar que alguien consintió un texto que todavía no existía.
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

/**
 * Datos del adulto responsable, sólo relevantes cuando quien se inscribe es
 * menor. Los mismos que pide `evaluateMinorGate`, con los nombres que usa
 * `ClickatonRegistration` (`adultResponsibleName`, `adultResponsibleContact`,
 * `adultAuthorizationAcceptedAt`, `accompanimentConfirmed`).
 */
export type LocationConsentAdultResponsible = {
  name?: string | null;
  contact?: string | null;
  authorizedAt?: Date | null;
  accompanimentConfirmed?: boolean | null;
};

export type LocationConsentFields = {
  locationConsentAt: Date | null;
  locationPublicConsentAt: Date | null;
  interviewConsentAt: Date | null;
  locationConsentVersion: string | null;
  /**
   * Pegajosa: una vez declarada la mayoría de edad, la declaración queda
   * aunque después se desmarque el mapa público. Perder esta declaración
   * borraría el registro de que la persona alguna vez la hizo.
   */
  locationConsentDeclaredAdult: boolean;
};

export function resolveLocationConsent(input: {
  choices: LocationConsentChoices;
  birthDate: Date | null;
  eventDate: Date;
  now: Date;
  previous?: LocationConsentFields;
  adultResponsible?: LocationConsentAdultResponsible;
}): LocationConsentFields {
  const { choices, now, previous } = input;

  const gate = evaluateMinorGate({
    birthDate: input.birthDate,
    eventDate: input.eventDate,
    adultName: input.adultResponsible?.name,
    adultDocumentOrContact: input.adultResponsible?.contact,
    adultAuthorizationAcceptedAt: input.adultResponsible?.authorizedAt,
    accompanimentConfirmed: input.adultResponsible?.accompanimentConfirmed,
  });

  // Menor sin autorización del adulto responsable: ninguna de las tres
  // casillas se otorga. Menor con autorización: la 1 y la 3 sí, la 2 nunca.
  // No menor: sin restricciones extra de este gate.
  const minorSinAutorizacion = gate.ok === false;
  const minorConAutorizacion = gate.ok === true && gate.isMinor === true;

  const personal = choices.personal && !minorSinAutorizacion;
  const publicMap =
    choices.publicMap &&
    personal &&
    choices.declaredAdult &&
    !minorSinAutorizacion &&
    !minorConAutorizacion;
  const interview = choices.interview && !minorSinAutorizacion;

  // Si el texto legal cambió de versión desde el último consentimiento
  // guardado, la fecha no se conserva: hay que poder probar que la persona
  // consintió ESTE texto, no uno anterior.
  const versionCambio =
    previous !== undefined &&
    previous.locationConsentVersion !== CLICKATON_LOCATION_CONSENT_VERSION;

  const keep = (granted: boolean, before: Date | null | undefined) =>
    granted ? (versionCambio ? now : (before ?? now)) : null;

  const fields: LocationConsentFields = {
    locationConsentAt: keep(personal, previous?.locationConsentAt),
    locationPublicConsentAt: keep(publicMap, previous?.locationPublicConsentAt),
    interviewConsentAt: keep(interview, previous?.interviewConsentAt),
    locationConsentVersion: null,
    locationConsentDeclaredAdult:
      Boolean(previous?.locationConsentDeclaredAdult) || choices.declaredAdult,
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

/**
 * Qué ve cada quien al entrar al formulario de la encuesta.
 *
 * La vista previa de administrador existe para poder mirar la encuesta sin
 * haber participado. Es deliberadamente un modo aparte y **no trae autor**:
 * sin autor no hay nada que guardar, así que mirar nunca puede convertirse en
 * responder ni por error ni a propósito.
 *
 * Quien participó contesta de verdad aunque además sea administrador: el
 * testimonio de alguien que estuvo vale más que una vista previa.
 */
import type { Eligibility, EligibilityDenialReason, EligibleAuthor } from "./eligibility";

export type SurveyAccess =
  | { mode: "answer"; author: EligibleAuthor }
  | { mode: "preview"; moduleEnabled: boolean }
  | { mode: "denied"; reason: EligibilityDenialReason }
  /** Ni siquiera se muestra la página: la encuesta de esa edición está cerrada. */
  | { mode: "closed" };

export function resolveSurveyAccess(input: {
  moduleEnabled: boolean;
  eligibility: Eligibility;
  isAdmin: boolean;
}): SurveyAccess {
  if (input.moduleEnabled && input.eligibility.eligible) {
    return { mode: "answer", author: input.eligibility };
  }

  if (input.isAdmin) {
    return { mode: "preview", moduleEnabled: input.moduleEnabled };
  }

  if (!input.moduleEnabled) return { mode: "closed" };

  if (!input.eligibility.eligible) {
    return { mode: "denied", reason: input.eligibility.reason };
  }

  // Inalcanzable: módulo encendido + elegible ya devolvió "answer" arriba.
  return { mode: "closed" };
}

export const SURVEY_PREVIEW_NOTICE =
  "Vista previa de administrador: estás viendo el formulario tal como lo ve un participante. Nada de lo que escribas acá se guarda.";

export const SURVEY_PREVIEW_MODULE_OFF_NOTICE =
  "Además, la encuesta de esta edición está apagada: hoy ningún participante puede entrar. Se enciende en Testimonios y calidad.";

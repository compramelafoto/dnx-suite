import { CONOCIMIENTO_CLF } from "./conocimiento";
import { IDENTIDAD } from "./identidad";

/**
 * Guía fija de DNX Bot (identidad + reglas + conocimiento de CLF).
 * Es lo que se cachea en el prompt: tiene que dar el mismo texto en cada llamada.
 * Nada de fechas, horas ni datos de usuarios acá; eso va en la situación de la cuenta.
 */
export function buildSystemGuide(): string {
  return `${IDENTIDAD}\n\n${CONOCIMIENTO_CLF}`;
}

/**
 * La encuesta de satisfacción de Clickatón, definida en un solo lugar.
 *
 * Los aspectos son fijos a propósito: si cada edición eligiera los suyos, los
 * promedios dejarían de ser comparables entre ediciones y el tablero perdería
 * su razón de ser. Cambiar el set es cambiar este archivo.
 */

export const SURVEY_ASPECT_FIELDS = [
  "scoreOrganization",
  "scorePrompts",
  "scoreVenue",
  "scoreKit",
  "scoreAccreditation",
  "scoreCommunication",
  "scoreValueForMoney",
] as const;

export type SurveyAspectField = (typeof SURVEY_ASPECT_FIELDS)[number];

export type SurveyAspect = {
  field: SurveyAspectField;
  label: string;
  help: string;
};

export const SURVEY_ASPECTS: readonly SurveyAspect[] = [
  {
    field: "scoreOrganization",
    label: "Organización general",
    help: "Los horarios, el orden, que todo pasara cuando tenía que pasar.",
  },
  {
    field: "scorePrompts",
    label: "Consignas y desafío fotográfico",
    help: "Qué te parecieron las consignas: claras, interesantes, jugables.",
  },
  {
    field: "scoreVenue",
    label: "Sede y punto de encuentro",
    help: "El lugar, cómo llegar, el espacio para arrancar y volver.",
  },
  {
    field: "scoreKit",
    label: "Kit y materiales",
    help: "Lo que recibiste: calidad, utilidad, si valía la pena.",
  },
  {
    field: "scoreAccreditation",
    label: "Acreditación",
    help: "La llegada, la fila, la entrega de credencial y kit.",
  },
  {
    field: "scoreCommunication",
    label: "Comunicación antes y durante",
    help: "Los correos, los avisos, saber siempre qué seguía.",
  },
  {
    field: "scoreValueForMoney",
    label: "Relación precio / valor",
    help: "Si lo que pagaste se corresponde con lo que viviste.",
  },
] as const;

export const NPS_QUESTION =
  "¿Qué tan probable es que le recomiendes Clickatón a otro fotógrafo?";

/**
 * La pregunta del texto publicable.
 *
 * La segunda frase no es relleno: abre la puerta al mensaje corto y afectuoso
 * —"gracias, chicos"— que es lo que mejor funciona en redes. Sin ella, mucha
 * gente contesta como si fuera un informe.
 */
export const QUOTE_QUESTION =
  "¿Qué querés decirnos sobre Clickatón? También podés dejarle un mensajito al equipo.";

export const NPS_MIN = 0;
export const NPS_MAX = 10;
export const ASPECT_MIN = 1;
export const ASPECT_MAX = 5;

export const QUOTE_MAX_LENGTH = 400;
/**
 * El recorte admite el testimonio entero: por defecto se publica completo, y
 * acortarlo es una decisión del admin, no un límite del sistema.
 */
export const EXCERPT_MAX_LENGTH = QUOTE_MAX_LENGTH;
export const IMPROVEMENT_MAX_LENGTH = 1000;

/** La promesa que hace que la gente critique en serio. No sacarla. */
export const IMPROVEMENT_PRIVACY_NOTICE =
  "Esto no se publica nunca. Lo lee sólo el equipo de Clickatón.";

export const WOULD_RETURN_OPTIONS = [
  { value: "YES", label: "Sí, seguro" },
  { value: "MAYBE", label: "Tal vez" },
  { value: "NO", label: "No" },
] as const;

export type WouldReturnValue = (typeof WOULD_RETURN_OPTIONS)[number]["value"];

export function isSurveyAspectField(value: string): value is SurveyAspectField {
  return (SURVEY_ASPECT_FIELDS as readonly string[]).includes(value);
}

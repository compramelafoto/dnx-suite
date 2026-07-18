import type { QuoteRequiredField } from "./models.js";

const QUESTIONS: Record<QuoteRequiredField, string> = {
  SERVICE_TYPE: "¿Qué tipo de evento o sesión fotográfica necesitás?",
  EVENT_DATE: "¿Para qué fecha necesitás el servicio?",
  CITY: "¿En qué ciudad o localidad se realizará?",
  DURATION_HOURS: "¿Cuántas horas de cobertura necesitás aproximadamente?",
};

export const QUOTE_READY_MESSAGE =
  "Ya tengo los datos básicos del trabajo. El siguiente paso será preparar el presupuesto.";

/**
 * Una sola próxima pregunta según el primer campo faltante (orden estable).
 */
export function selectNextQuoteQuestion(missingFields: QuoteRequiredField[]): string {
  const next = missingFields[0];
  if (!next) return QUOTE_READY_MESSAGE;
  return QUESTIONS[next];
}

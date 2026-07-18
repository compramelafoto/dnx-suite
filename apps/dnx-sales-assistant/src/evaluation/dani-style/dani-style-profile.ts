/** Perfil versionado — herramienta de regresión interna, no juicio humano absoluto. */
export const DANI_STYLE_VERSION = "dani-style-v1" as const;

export type DaniStyleVersion = typeof DANI_STYLE_VERSION;

/**
 * Pesos de descuento (partiendo de 100).
 * Documentados para evitar magic numbers dispersos.
 */
export const DANI_STYLE_SCORE_WEIGHTS = {
  REPEATED_QUESTION: 20,
  ALREADY_KNOWN_FIELD: 20,
  FORM_LANGUAGE: 15,
  TECHNICAL_LANGUAGE: 15,
  MULTIPLE_QUESTIONS: 10,
  TOO_LONG: 10,
  CHATBOT_PHRASE: 10,
  EXCESSIVE_ENTHUSIASM: 5,
  REPEATED_CONFIRMATION: 5,
  CONTEXT_LOSS: 20,
} as const;

/** Longitud máxima razonable (caracteres) para una respuesta breve. */
export const DANI_STYLE_MAX_MESSAGE_LENGTH = 220;

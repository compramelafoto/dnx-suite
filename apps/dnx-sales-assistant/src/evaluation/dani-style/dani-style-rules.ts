export const DaniStyleRuleCode = {
  DANI_STYLE_FORM_LANGUAGE: "DANI_STYLE_FORM_LANGUAGE",
  DANI_STYLE_TOO_LONG: "DANI_STYLE_TOO_LONG",
  DANI_STYLE_MULTIPLE_QUESTIONS: "DANI_STYLE_MULTIPLE_QUESTIONS",
  DANI_STYLE_REPEATED_CONFIRMATION: "DANI_STYLE_REPEATED_CONFIRMATION",
  DANI_STYLE_REPEATED_QUESTION: "DANI_STYLE_REPEATED_QUESTION",
  DANI_STYLE_ALREADY_KNOWN_FIELD: "DANI_STYLE_ALREADY_KNOWN_FIELD",
  DANI_STYLE_TECHNICAL_LANGUAGE: "DANI_STYLE_TECHNICAL_LANGUAGE",
  DANI_STYLE_CHATBOT_PHRASE: "DANI_STYLE_CHATBOT_PHRASE",
  DANI_STYLE_EXCESSIVE_ENTHUSIASM: "DANI_STYLE_EXCESSIVE_ENTHUSIASM",
  DANI_STYLE_CONTEXT_LOSS: "DANI_STYLE_CONTEXT_LOSS",
} as const;

export type DaniStyleRuleCode =
  (typeof DaniStyleRuleCode)[keyof typeof DaniStyleRuleCode];

export type DaniStyleSeverity = "INFO" | "WARN" | "ERROR";

export type DaniStyleFlag = {
  code: DaniStyleRuleCode;
  severity: DaniStyleSeverity;
  turnNumber: number;
  fragment: string;
  explanation: string;
  suggestion: string;
};

export const CHATBOT_PHRASE_RE =
  /\b(estoy aqu[ií] para ayudarte|¿en qu[eé] puedo ayudarte\??|tu solicitud fue recibida|procesando tu consulta|modo simulación)\b/i;

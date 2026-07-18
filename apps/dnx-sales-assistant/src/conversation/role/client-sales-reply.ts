import type { QuoteRequestDraft, QuoteRequiredField } from "../../quote-request/models.js";
import { getMissingQuoteFields } from "../../quote-request/get-missing-fields.js";
import { CLIENT_SYSTEM_PROMPT } from "./role-prompts.js";

export type ClientSalesReplyInput = {
  userMessage: string;
  draft?: QuoteRequestDraft;
  previouslyAskedCommercial?: string[];
};

export type ClientSalesReplyResult = {
  text: string;
  nextQuestion?: string;
  askedCommercialProbe?: string;
  /** Prompt de sistema aplicado (para tests / lab). */
  systemPrompt: string;
};

const COMMERCIAL_PROBES: Array<{ id: string; question: string }> = [
  {
    id: "schedule",
    question: "¿Tenés una idea del horario aproximado del evento?",
  },
  {
    id: "ceremony_party",
    question: "¿Hay ceremonia y después fiesta, o es un solo momento?",
  },
  {
    id: "guests",
    question: "Más o menos, ¿cuántos invitados están?",
  },
  {
    id: "photographers",
    question: "¿Les gustaría un fotógrafo o un equipo de dos?",
  },
  {
    id: "video",
    question: "¿También están pensando en video, o por ahora solo foto?",
  },
  {
    id: "delivery",
    question: "¿Cómo les gusta recibir las fotos? ¿Galería online, album, o ambas?",
  },
];

const INTERNAL_LEAK =
  /\bm[ií]nimo sostenible\b|\bgastos?\b|\bamortizaci|\bfactor comercial\b|\bperfil econ[oó]mico\b|\bOWNER\b|\bbreakdown\b|\brecommendedBusiness\b/i;

function serviceLabel(draft?: QuoteRequestDraft): string {
  switch (draft?.serviceType) {
    case "WEDDING":
      return "casamiento";
    case "FIFTEENTH_BIRTHDAY":
      return "quince";
    case "SPORTS_EVENT":
      return "cobertura deportiva";
    case "FAMILY_SESSION":
    case "PORTRAIT_SESSION":
      return "sesión";
    default:
      return "evento";
  }
}

function askForField(field: QuoteRequiredField): string {
  switch (field) {
    case "SERVICE_TYPE":
      return "Contame un poco: ¿qué tipo de evento están organizando?";
    case "CITY":
      return "¿En qué ciudad o zona sería?";
    case "EVENT_DATE":
      return "¿Ya tienen fecha, aunque sea aproximada?";
    case "DURATION_HOURS":
      return "¿Cuántas horas de cobertura se imaginan?";
    default:
      return "¿Me contás un poco más del evento?";
  }
}

/**
 * Respuesta comercial en modo CLIENT (determinística, sin precios).
 */
export function composeClientSalesReply(
  input: ClientSalesReplyInput,
): ClientSalesReplyResult {
  const draft = input.draft;
  const missing = getMissingQuoteFields(draft ?? {});
  const asked = new Set(input.previouslyAskedCommercial ?? []);
  const msg = input.userMessage.trim();

  if (/^(hola|buen[oa]s|hey)\b/i.test(msg) && missing.length === 4) {
    return {
      systemPrompt: CLIENT_SYSTEM_PROMPT,
      text: [
        "¡Hola! Qué bueno que escribas.",
        "",
        "Me encantaría armarles algo a medida.",
        "Contame un poco del evento: ¿qué están celebrando y en qué ciudad sería?",
      ].join("\n"),
      nextQuestion: askForField("SERVICE_TYPE"),
    };
  }

  if (missing.length > 0) {
    const field = missing[0]!;
    const question = askForField(field);
    const lead =
      missing.length === 4
        ? "Dale, te ayudo a ver la mejor opción."
        : "Perfecto, vamos encaminados.";
    return {
      systemPrompt: CLIENT_SYSTEM_PROMPT,
      text: `${lead}\n\n${question}`,
      nextQuestion: question,
    };
  }

  const nextProbe = COMMERCIAL_PROBES.find((p) => !asked.has(p.id));
  if (nextProbe) {
    const city = draft?.city ? ` en ${draft.city}` : "";
    const label = serviceLabel(draft);
    return {
      systemPrompt: CLIENT_SYSTEM_PROMPT,
      text: [
        `Buenísimo, ya tengo lo principal del ${label}${city}.`,
        "",
        nextProbe.question,
      ].join("\n"),
      nextQuestion: nextProbe.question,
      askedCommercialProbe: nextProbe.id,
    };
  }

  // Cierre comercial — sin precios
  const close = [
    "Perfecto.",
    "",
    "Ya tengo la información principal.",
    "Voy a preparar una propuesta adecuada para ustedes.",
  ].join("\n");

  return {
    systemPrompt: CLIENT_SYSTEM_PROMPT,
    text: close,
    nextQuestion: undefined,
  };
}

/** Garantiza que no se filtren términos internos en modo CLIENT. */
export function assertClientSafeText(text: string): boolean {
  return !INTERNAL_LEAK.test(text);
}

export function sanitizeClientFacingText(text: string): string {
  if (!INTERNAL_LEAK.test(text)) return text;
  return [
    "Perfecto.",
    "",
    "Ya tengo la información principal.",
    "Voy a preparar una propuesta adecuada para ustedes.",
  ].join("\n");
}

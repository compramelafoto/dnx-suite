import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import type { QuoteRequiredField } from "../../quote-request/models.js";
import type { ConversationMetrics } from "./conversation-metrics.js";

const FORM_RE =
  /\b(indique|ingrese|complete el campo|faltan? completar|siguiente información|su solicitud se encuentra|para continuar con el proceso)\b/i;

const TECH_RE =
  /\b(dto|draft|pipeline|runtime|READY_FOR_CALCULATION|quoteRequest|pricingResult|orquestador|validaci[oó]n estructural)\b/i;

const CONFIRM_RE = /^(perfecto|excelente|genial|¡?perfecto|¡?excelente|¡?genial)\b/i;

const FIELD_QUESTION_HINTS: Array<{ field: QuoteRequiredField; re: RegExp }> = [
  { field: "SERVICE_TYPE", re: /qu[eé] tipo de trabajo|contame un poco qu[eé] te pidieron|evento, una sesi[oó]n/i },
  {
    field: "EVENT_DATE",
    re: /qu[eé] fecha|para qu[eé] fecha|¿cu[aá]ndo|cu[aá]ndo ser[ií]a|cu[aá]ndo es\b|qu[eé] d[ií]a|ten[eé]s una fecha/i,
  },
  { field: "CITY", re: /qu[eé] ciudad|d[oó]nde|localidad/i },
  { field: "DURATION_HOURS", re: /cu[aá]ntas horas|horas de cobertura|cobertura de varias horas/i },
];

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function knownFieldsFromDraft(draft: {
  serviceType?: string;
  eventDate?: string;
  city?: string;
  durationHours?: number;
} | undefined): Set<QuoteRequiredField> {
  const set = new Set<QuoteRequiredField>();
  if (!draft) return set;
  if (draft.serviceType && draft.serviceType !== "UNKNOWN") set.add("SERVICE_TYPE");
  if (draft.eventDate) set.add("EVENT_DATE");
  if (draft.city) set.add("CITY");
  if (draft.durationHours !== undefined) set.add("DURATION_HOURS");
  return set;
}

/**
 * Métricas deterministas sobre el transcript.
 * `knownBeforeTurn[i]` = campos ya conocidos antes del mensaje de usuario del turno i.
 */
export function computeConversationMetrics(
  transcript: ConversationTranscript,
  knownBeforeTurn: Array<Set<QuoteRequiredField>>,
): ConversationMetrics {
  const turns = transcript.turns;
  let assistantQuestions = 0;
  let repeatedQuestions = 0;
  let alreadyKnownFieldQuestions = 0;
  let multiQuestionMessages = 0;
  let formLikeMessages = 0;
  let technicalLanguageFlags = 0;
  let unnecessaryConfirmationFlags = 0;
  let longest = 0;
  let totalLen = 0;
  const seenQuestions = new Set<string>();
  const phraseCounts = new Map<string, number>();

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i]!;
    const msg = turn.assistantMessage.trim();
    totalLen += msg.length;
    if (msg.length > longest) longest = msg.length;

    const qCount = countQuestions(msg);
    if (qCount > 0) assistantQuestions += 1;
    if (qCount > 1) multiQuestionMessages += 1;

    if (FORM_RE.test(msg)) formLikeMessages += 1;
    if (TECH_RE.test(msg)) technicalLanguageFlags += 1;
    if (CONFIRM_RE.test(msg)) unnecessaryConfirmationFlags += 1;

    const normalizedQ = msg.toLowerCase();
    phraseCounts.set(normalizedQ, (phraseCounts.get(normalizedQ) ?? 0) + 1);

    if (qCount > 0) {
      if (seenQuestions.has(normalizedQ)) repeatedQuestions += 1;
      seenQuestions.add(normalizedQ);
    }

    const known = knownBeforeTurn[i] ?? new Set<QuoteRequiredField>();
    // También los campos que el usuario acaba de informar en este turno
    for (const f of turn.extractedFields) known.add(f);

    for (const hint of FIELD_QUESTION_HINTS) {
      if (hint.re.test(msg) && known.has(hint.field)) {
        alreadyKnownFieldQuestions += 1;
      }
    }
  }

  let repeatedPhraseFlags = 0;
  for (const count of phraseCounts.values()) {
    if (count > 1) repeatedPhraseFlags += count - 1;
  }

  return {
    totalTurns: turns.length,
    assistantQuestions,
    repeatedQuestions,
    alreadyKnownFieldQuestions,
    averageAssistantMessageLength:
      turns.length === 0 ? 0 : Math.round(totalLen / turns.length),
    longestAssistantMessageLength: longest,
    multiQuestionMessages,
    formLikeMessages,
    technicalLanguageFlags,
    repeatedPhraseFlags,
    unnecessaryConfirmationFlags,
    reachedReadyForCalculation:
      transcript.final.quoteStatus === "READY_FOR_CALCULATION",
    finalQuoteStatus: transcript.final.quoteStatus,
    pricingRuntimeStatus: transcript.final.pricingRuntimeStatus,
  };
}

export {
  FORM_RE,
  TECH_RE,
  CONFIRM_RE,
  FIELD_QUESTION_HINTS,
  knownFieldsFromDraft,
  countQuestions,
};

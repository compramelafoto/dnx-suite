import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import {
  CONFIRM_RE,
  countQuestions,
  FIELD_QUESTION_HINTS,
  FORM_RE,
  TECH_RE,
} from "../metrics/compute-conversation-metrics.js";
import type { QuoteRequiredField } from "../../quote-request/models.js";
import {
  DANI_STYLE_MAX_MESSAGE_LENGTH,
  DANI_STYLE_SCORE_WEIGHTS,
  DANI_STYLE_VERSION,
} from "./dani-style-profile.js";
import {
  CHATBOT_PHRASE_RE,
  DaniStyleRuleCode,
  type DaniStyleFlag,
} from "./dani-style-rules.js";
import type { DaniStyleResult } from "./dani-style-result.js";

function clip(text: string, max = 80): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Evaluación determinista dani-style-v1.
 * No reescribe respuestas; solo analiza.
 */
export function evaluateDaniStyle(
  transcript: ConversationTranscript,
  knownBeforeTurn: Array<Set<QuoteRequiredField>>,
): DaniStyleResult {
  const flags: DaniStyleFlag[] = [];
  const seenQuestions = new Set<string>();
  let confirmationCount = 0;

  for (let i = 0; i < transcript.turns.length; i += 1) {
    const turn = transcript.turns[i]!;
    const msg = turn.assistantMessage;
    const turnNumber = turn.turnNumber;

    if (FORM_RE.test(msg)) {
      flags.push({
        code: DaniStyleRuleCode.DANI_STYLE_FORM_LANGUAGE,
        severity: "WARN",
        turnNumber,
        fragment: clip(msg),
        explanation: "Lenguaje de formulario / proceso administrativo.",
        suggestion: "Preferir preguntas naturales: «¿Cuándo sería?»",
      });
    }

    if (TECH_RE.test(msg)) {
      flags.push({
        code: DaniStyleRuleCode.DANI_STYLE_TECHNICAL_LANGUAGE,
        severity: "ERROR",
        turnNumber,
        fragment: clip(msg),
        explanation: "Menciona términos técnicos internos.",
        suggestion: "No hablar de drafts, DTOs ni estados internos.",
      });
    }

    if (msg.length > DANI_STYLE_MAX_MESSAGE_LENGTH) {
      flags.push({
        code: DaniStyleRuleCode.DANI_STYLE_TOO_LONG,
        severity: "WARN",
        turnNumber,
        fragment: clip(msg),
        explanation: `Respuesta larga (${msg.length} caracteres).`,
        suggestion: "Acortar y dejar una sola idea principal.",
      });
    }

    if (countQuestions(msg) > 1) {
      flags.push({
        code: DaniStyleRuleCode.DANI_STYLE_MULTIPLE_QUESTIONS,
        severity: "WARN",
        turnNumber,
        fragment: clip(msg),
        explanation: "Más de una pregunta principal en el mismo turno.",
        suggestion: "Una pregunta principal por mensaje.",
      });
    }

    if (CHATBOT_PHRASE_RE.test(msg)) {
      flags.push({
        code: DaniStyleRuleCode.DANI_STYLE_CHATBOT_PHRASE,
        severity: "WARN",
        turnNumber,
        fragment: clip(msg),
        explanation: "Frase genérica de chatbot.",
        suggestion: "Sonar como colega fotógrafo, no como bot genérico.",
      });
    }

    if ((msg.match(/¡/g) ?? []).length >= 2 || /!!!/.test(msg)) {
      flags.push({
        code: DaniStyleRuleCode.DANI_STYLE_EXCESSIVE_ENTHUSIASM,
        severity: "INFO",
        turnNumber,
        fragment: clip(msg),
        explanation: "Entusiasmo artificial excesivo.",
        suggestion: "Calidez sin exagerar.",
      });
    }

    if (CONFIRM_RE.test(msg.trim())) {
      confirmationCount += 1;
      if (confirmationCount > 1) {
        flags.push({
          code: DaniStyleRuleCode.DANI_STYLE_REPEATED_CONFIRMATION,
          severity: "INFO",
          turnNumber,
          fragment: clip(msg),
          explanation: "Confirmación tipo Perfecto/Excelente repetida.",
          suggestion: "No abrir todos los turnos con la misma confirmación.",
        });
      }
    }

    const normalized = msg.trim().toLowerCase();
    if (countQuestions(msg) > 0) {
      if (seenQuestions.has(normalized)) {
        flags.push({
          code: DaniStyleRuleCode.DANI_STYLE_REPEATED_QUESTION,
          severity: "ERROR",
          turnNumber,
          fragment: clip(msg),
          explanation: "Misma pregunta repetida en otro turno.",
          suggestion: "Avanzar o reformular con el contexto ya conocido.",
        });
      }
      seenQuestions.add(normalized);
    }

    const known = new Set(knownBeforeTurn[i] ?? []);
    for (const f of turn.extractedFields) known.add(f);

    for (const hint of FIELD_QUESTION_HINTS) {
      if (hint.re.test(msg) && known.has(hint.field)) {
        flags.push({
          code: DaniStyleRuleCode.DANI_STYLE_ALREADY_KNOWN_FIELD,
          severity: "ERROR",
          turnNumber,
          fragment: clip(msg),
          explanation: `Pregunta por ${hint.field} que ya estaba informado.`,
          suggestion: "Usar la información ya dada y preguntar solo lo faltante.",
        });
        flags.push({
          code: DaniStyleRuleCode.DANI_STYLE_CONTEXT_LOSS,
          severity: "ERROR",
          turnNumber,
          fragment: clip(msg),
          explanation: "Pérdida de continuidad: se ignora un dato ya conocido.",
          suggestion: "Mantener el hilo de lo que el usuario ya contó.",
        });
      }
    }
  }

  let score = 100;
  const applied = new Set<string>();
  for (const flag of flags) {
    const key = `${flag.code}:${flag.turnNumber}:${flag.fragment}`;
    if (applied.has(key)) continue;
    applied.add(key);
    switch (flag.code) {
      case DaniStyleRuleCode.DANI_STYLE_REPEATED_QUESTION:
        score -= DANI_STYLE_SCORE_WEIGHTS.REPEATED_QUESTION;
        break;
      case DaniStyleRuleCode.DANI_STYLE_ALREADY_KNOWN_FIELD:
        score -= DANI_STYLE_SCORE_WEIGHTS.ALREADY_KNOWN_FIELD;
        break;
      case DaniStyleRuleCode.DANI_STYLE_CONTEXT_LOSS:
        // ya descontado vía ALREADY_KNOWN en el mismo hallazgo; evitar doble
        break;
      case DaniStyleRuleCode.DANI_STYLE_FORM_LANGUAGE:
        score -= DANI_STYLE_SCORE_WEIGHTS.FORM_LANGUAGE;
        break;
      case DaniStyleRuleCode.DANI_STYLE_TECHNICAL_LANGUAGE:
        score -= DANI_STYLE_SCORE_WEIGHTS.TECHNICAL_LANGUAGE;
        break;
      case DaniStyleRuleCode.DANI_STYLE_MULTIPLE_QUESTIONS:
        score -= DANI_STYLE_SCORE_WEIGHTS.MULTIPLE_QUESTIONS;
        break;
      case DaniStyleRuleCode.DANI_STYLE_TOO_LONG:
        score -= DANI_STYLE_SCORE_WEIGHTS.TOO_LONG;
        break;
      case DaniStyleRuleCode.DANI_STYLE_CHATBOT_PHRASE:
        score -= DANI_STYLE_SCORE_WEIGHTS.CHATBOT_PHRASE;
        break;
      case DaniStyleRuleCode.DANI_STYLE_EXCESSIVE_ENTHUSIASM:
        score -= DANI_STYLE_SCORE_WEIGHTS.EXCESSIVE_ENTHUSIASM;
        break;
      case DaniStyleRuleCode.DANI_STYLE_REPEATED_CONFIRMATION:
        score -= DANI_STYLE_SCORE_WEIGHTS.REPEATED_CONFIRMATION;
        break;
      default:
        break;
    }
  }

  return {
    version: DANI_STYLE_VERSION,
    score: Math.max(0, Math.min(100, score)),
    flags,
  };
}

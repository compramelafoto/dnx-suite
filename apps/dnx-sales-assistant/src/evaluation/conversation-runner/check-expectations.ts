import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import type { ConversationMetrics } from "../metrics/conversation-metrics.js";
import {
  FIELD_QUESTION_HINTS,
  FORM_RE,
  TECH_RE,
} from "../metrics/compute-conversation-metrics.js";
import type { DaniStyleResult } from "../dani-style/dani-style-result.js";
import type {
  ConversationScenarioExpectations,
  ScenarioFieldExpectation,
} from "./conversation-scenario.js";
import type { ExpectationFailure } from "./conversation-run-result.js";

function draftHasField(
  draft: ConversationTranscript["final"]["draft"],
  field: ScenarioFieldExpectation,
): boolean {
  if (!draft) return false;
  if (field === "SERVICE_TYPE")
    return Boolean(draft.serviceType && draft.serviceType !== "UNKNOWN");
  if (field === "EVENT_DATE") return Boolean(draft.eventDate);
  if (field === "CITY") return Boolean(draft.city);
  if (field === "DURATION_HOURS") return draft.durationHours !== undefined;
  return false;
}

export function checkExpectations(input: {
  expectations?: ConversationScenarioExpectations;
  transcript: ConversationTranscript;
  metrics: ConversationMetrics;
  finalIntent?: string;
  daniStyle?: DaniStyleResult;
}): ExpectationFailure[] {
  const failures: ExpectationFailure[] = [];
  const exp = input.expectations;
  if (!exp) return failures;

  if (exp.expectedIntent && input.finalIntent !== exp.expectedIntent) {
    failures.push({
      code: "EXPECTED_INTENT",
      message: `Intent esperado ${exp.expectedIntent}, obtuvo ${input.finalIntent ?? "undefined"}`,
    });
  }

  if (exp.allowedIntents && input.finalIntent) {
    if (!exp.allowedIntents.includes(input.finalIntent as never)) {
      failures.push({
        code: "ALLOWED_INTENT",
        message: `Intent ${input.finalIntent} no está en allowedIntents`,
      });
    }
  }

  for (const field of exp.expectedKnownFields ?? []) {
    if (!draftHasField(input.transcript.final.draft, field)) {
      failures.push({
        code: "EXPECTED_FIELD",
        message: `Campo esperado no detectado: ${field}`,
      });
    }
  }

  for (const field of exp.forbiddenQuestionsAbout ?? []) {
    const hint = FIELD_QUESTION_HINTS.find((h) => h.field === field);
    if (!hint) continue;
    for (const turn of input.transcript.turns) {
      if (hint.re.test(turn.assistantMessage) && draftHasField(input.transcript.final.draft, field)) {
        // Fail if the field was already extracted in this or a previous turn.
        if (
          turn.extractedFields.includes(field) ||
          input.transcript.turns
            .slice(0, turn.turnNumber)
            .some((t) => t.extractedFields.includes(field))
        ) {
          failures.push({
            code: "FORBIDDEN_QUESTION",
            message: `Preguntó por ${field} pese a estar informado (turno ${turn.turnNumber})`,
          });
          break;
        }
      }
    }
  }

  const maxQ = exp.maximumAssistantQuestionsPerTurn ?? 1;
  for (const turn of input.transcript.turns) {
    const q = (turn.assistantMessage.match(/\?/g) ?? []).length;
    if (q > maxQ) {
      failures.push({
        code: "MAX_QUESTIONS_PER_TURN",
        message: `Turno ${turn.turnNumber}: ${q} preguntas (máx ${maxQ})`,
      });
    }
  }

  if (exp.shouldReachReadyForCalculation === true) {
    if (input.transcript.final.quoteStatus !== "READY_FOR_CALCULATION") {
      failures.push({
        code: "READY_REQUIRED",
        message: `Debía llegar a READY_FOR_CALCULATION, obtuvo ${input.transcript.final.quoteStatus ?? "n/a"}`,
      });
    }
  }

  if (exp.shouldNotReachReady === true) {
    if (input.transcript.final.quoteStatus === "READY_FOR_CALCULATION") {
      failures.push({
        code: "READY_FORBIDDEN",
        message: "No debía llegar a READY_FOR_CALCULATION",
      });
    }
  }

  if (exp.expectPricingReady === true) {
    if (input.transcript.final.pricingRuntimeStatus !== "READY") {
      failures.push({
        code: "PRICING_READY_REQUIRED",
        message: `Pricing debía ser READY, obtuvo ${input.transcript.final.pricingRuntimeStatus ?? "n/a"}`,
      });
    }
  }

  if (exp.minimumDaniStyleScore !== undefined && input.daniStyle) {
    if (input.daniStyle.score < exp.minimumDaniStyleScore) {
      failures.push({
        code: "MIN_DANI_SCORE",
        message: `Score ${input.daniStyle.score} < mínimo ${exp.minimumDaniStyleScore}`,
      });
    }
  }

  if (exp.forbidFormAndTechnicalLanguage) {
    for (const turn of input.transcript.turns) {
      if (FORM_RE.test(turn.assistantMessage)) {
        failures.push({
          code: "FORM_LANGUAGE",
          message: `Lenguaje de formulario en turno ${turn.turnNumber}`,
        });
      }
      if (TECH_RE.test(turn.assistantMessage)) {
        failures.push({
          code: "TECHNICAL_LANGUAGE",
          message: `Lenguaje técnico en turno ${turn.turnNumber}`,
        });
      }
    }
  }

  if (exp.expectVisualReference) {
    const seen = input.transcript.turns.some((t) => t.visualReferenceRequested);
    if (!seen) {
      failures.push({
        code: "VISUAL_REFERENCE_REQUIRED",
        message: "Debía detectar solicitud visual",
      });
    }
  }

  const styleStrict =
    Boolean(exp.criticalStyleScenario) ||
    exp.minimumDaniStyleScore !== undefined ||
    Boolean(exp.forbidFormAndTechnicalLanguage);

  if (styleStrict && input.metrics.repeatedQuestions > 0) {
    failures.push({
      code: "REPEATED_QUESTION",
      message: `Preguntas repetidas: ${input.metrics.repeatedQuestions}`,
    });
  }

  if (styleStrict && input.metrics.alreadyKnownFieldQuestions > 0) {
    failures.push({
      code: "ALREADY_KNOWN_QUESTION",
      message: `Preguntas sobre datos conocidos: ${input.metrics.alreadyKnownFieldQuestions}`,
    });
  }

  for (const turn of input.transcript.turns) {
    if (
      /recommendedBusiness|breakdown|hourlyRate|READY_FOR_CALCULATION|pricingResult/i.test(
        turn.assistantMessage,
      )
    ) {
      failures.push({
        code: "INTERNAL_OR_PRICE_LEAK",
        message: `Fuga interna/precio en turno ${turn.turnNumber}`,
      });
    }
  }

  return failures;
}

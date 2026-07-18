import type { ConversationRunResult } from "../conversation-runner/conversation-run-result.js";
import { transcriptContainsPriceLeak } from "../conversation-transcript/transcript-serializer.js";

/**
 * Reporte legible — sin precios ni breakdown.
 */
export function renderConversationReport(result: ConversationRunResult): string {
  const lines: string[] = [];
  const { scenario, transcript, metrics, daniStyle, passed, expectationFailures } =
    result;

  lines.push(`SCENARIO: ${scenario.id}`);
  lines.push(`STATUS: ${passed ? "PASSED" : "FAILED"}`);
  lines.push(`FINAL STATE: ${transcript.final.quoteStatus ?? "n/a"}`);
  lines.push(`PRICING: ${transcript.final.pricingRuntimeStatus ?? "n/a"}`);
  lines.push(`DANI STYLE VERSION: ${daniStyle.version}`);
  lines.push("");

  for (const turn of transcript.turns) {
    lines.push(`TURN ${turn.turnNumber}`);
    lines.push("USER:");
    lines.push(turn.userMessage);
    lines.push("");
    lines.push("ASSISTANT:");
    lines.push(turn.assistantMessage);
    lines.push("");
    lines.push("DETECTED:");
    if (turn.extractedFields.length === 0) lines.push("- (none this turn)");
    else for (const f of turn.extractedFields) lines.push(`- ${f}`);
    lines.push("");
    lines.push("MISSING:");
    if (turn.missingFields.length === 0) lines.push("- (none)");
    else for (const f of turn.missingFields) lines.push(`- ${f}`);
    if (turn.detectedIntent) lines.push(`INTENT: ${turn.detectedIntent}`);
    if (turn.visualReferenceRequested) {
      lines.push(
        `VISUAL REF (diagnostic): yes${turn.visualNiche ? ` / ${turn.visualNiche}` : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("DANI STYLE:");
  lines.push(`Score: ${daniStyle.score}/100`);
  lines.push("Flags:");
  if (daniStyle.flags.length === 0) lines.push("- none");
  else {
    for (const flag of daniStyle.flags) {
      lines.push(
        `- [${flag.severity}] ${flag.code} (turn ${flag.turnNumber}): ${flag.explanation}`,
      );
    }
  }
  lines.push("");
  lines.push("METRICS:");
  lines.push(`- turns: ${metrics.totalTurns}`);
  lines.push(`- assistant questions: ${metrics.assistantQuestions}`);
  lines.push(`- repeated questions: ${metrics.repeatedQuestions}`);
  lines.push(`- already-known questions: ${metrics.alreadyKnownFieldQuestions}`);
  lines.push(`- form-like messages: ${metrics.formLikeMessages}`);
  lines.push(`- technical language flags: ${metrics.technicalLanguageFlags}`);
  lines.push(`- multi-question messages: ${metrics.multiQuestionMessages}`);
  lines.push(`- avg assistant length: ${metrics.averageAssistantMessageLength}`);
  lines.push(`- longest assistant length: ${metrics.longestAssistantMessageLength}`);
  lines.push(`- reached READY_FOR_CALCULATION: ${metrics.reachedReadyForCalculation}`);
  lines.push(`- pricing runtime: ${metrics.pricingRuntimeStatus ?? "n/a"}`);

  if (expectationFailures.length > 0) {
    lines.push("");
    lines.push("EXPECTATION FAILURES:");
    for (const f of expectationFailures) {
      lines.push(`- [${f.code}] ${f.message}`);
    }
  }

  const text = lines.join("\n");
  if (transcriptContainsPriceLeak(text)) {
    return `${text}\n\nERROR: price leak detected in report (internal bug).\n`;
  }
  return `${text}\n`;
}

export function renderEvaluationSummary(results: ConversationRunResult[]): string {
  const lines = [
    "CONVERSATION EVALUATION SUMMARY",
    `Total: ${results.length}`,
    `Passed: ${results.filter((r) => r.passed).length}`,
    `Failed: ${results.filter((r) => !r.passed).length}`,
    "",
  ];
  for (const r of results) {
    lines.push(
      `${r.passed ? "PASS" : "FAIL"}  ${r.scenario.id}  dani=${r.daniStyle.score}  pricing=${r.transcript.final.pricingRuntimeStatus ?? "n/a"}  quote=${r.transcript.final.quoteStatus ?? "n/a"}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

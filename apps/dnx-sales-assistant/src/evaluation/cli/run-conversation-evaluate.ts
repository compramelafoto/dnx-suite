import { runConversationScenario } from "../conversation-runner/run-conversation-scenario.js";
import type { ConversationRunResult } from "../conversation-runner/conversation-run-result.js";
import {
  renderConversationReport,
  renderEvaluationSummary,
} from "../report/render-conversation-report.js";
import {
  CONVERSATION_SCENARIOS,
  getScenarioById,
} from "../scenarios/catalog.js";
import { serializeTranscript } from "../conversation-transcript/transcript-serializer.js";

export type EvaluateCliOptions = {
  scenarioId?: string;
  json?: boolean;
  verbose?: boolean;
};

export async function runConversationEvaluate(
  options: EvaluateCliOptions = {},
): Promise<{ exitCode: number; lines: string[]; results: ConversationRunResult[] }> {
  const scenarios = options.scenarioId
    ? (() => {
        const s = getScenarioById(options.scenarioId!);
        if (!s) {
          return null;
        }
        return [s];
      })()
    : CONVERSATION_SCENARIOS;

  if (!scenarios) {
    return {
      exitCode: 2,
      lines: [`Escenario desconocido: ${options.scenarioId}`],
      results: [],
    };
  }

  const results: ConversationRunResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runConversationScenario(scenario));
  }

  const lines: string[] = [];
  if (options.json) {
    const safe = results.map((r) => ({
      id: r.scenario.id,
      passed: r.passed,
      score: r.daniStyle.score,
      quoteStatus: r.transcript.final.quoteStatus,
      pricingRuntimeStatus: r.transcript.final.pricingRuntimeStatus,
      expectationFailures: r.expectationFailures,
      metrics: r.metrics,
      daniStyle: {
        version: r.daniStyle.version,
        score: r.daniStyle.score,
        flags: r.daniStyle.flags.map((f) => ({
          code: f.code,
          severity: f.severity,
          turnNumber: f.turnNumber,
          explanation: f.explanation,
        })),
      },
      transcript: r.transcript,
    }));
    lines.push(JSON.stringify({ results: safe }, null, 2));
  } else {
    lines.push(renderEvaluationSummary(results).trimEnd());
    if (options.verbose || options.scenarioId) {
      for (const r of results) {
        lines.push("");
        lines.push(renderConversationReport(r).trimEnd());
      }
    } else {
      for (const r of results.filter((x) => !x.passed)) {
        lines.push("");
        lines.push(renderConversationReport(r).trimEnd());
      }
    }
  }

  const exitCode = results.every((r) => r.passed) ? 0 : 1;
  return { exitCode, lines, results };
}

/** Utilidad para tests: serializar un transcript aislado. */
export function serializeRunTranscript(result: ConversationRunResult): string {
  return serializeTranscript(result.transcript);
}

import { runConversationScenario } from "../conversation-runner/run-conversation-scenario.js";
import { CONVERSATION_SCENARIOS } from "../scenarios/catalog.js";
import type { ConversationRunResult } from "../conversation-runner/conversation-run-result.js";
import { DaniStyleRuleCode } from "../dani-style/dani-style-rules.js";

type CompareRow = {
  scenarioId: string;
  legacyResponse: string;
  daniResponse: string;
  legacyScore: number;
  daniScore: number;
  flagsRemoved: string[];
  flagsIntroduced: string[];
  status: "IMPROVED" | "REGRESSED" | "UNCHANGED" | "MIXED";
  legacyMetrics: ConversationRunResult["metrics"];
  daniMetrics: ConversationRunResult["metrics"];
};

function lastAssistant(result: ConversationRunResult): string {
  const turns = result.transcript.turns;
  return turns[turns.length - 1]?.assistantMessage ?? "";
}

function flagCodes(result: ConversationRunResult): string[] {
  return [...new Set(result.daniStyle.flags.map((f) => f.code))];
}

function compareStatus(legacy: number, dani: number): CompareRow["status"] {
  if (dani > legacy + 2) return "IMPROVED";
  if (dani < legacy - 2) return "REGRESSED";
  if (dani === legacy) return "UNCHANGED";
  return "MIXED";
}

async function compareAll(): Promise<CompareRow[]> {
  const rows: CompareRow[] = [];
  for (const scenario of CONVERSATION_SCENARIOS) {
    const legacy = await runConversationScenario(scenario, {
      styleEngine: "legacy",
      from: `5491${Math.abs(hash(scenario.id) % 1_000_000_00)}`,
    });
    const dani = await runConversationScenario(scenario, {
      styleEngine: "dani-conversation-v1",
      from: `5492${Math.abs(hash(scenario.id) % 1_000_000_00)}`,
    });
    const legacyFlags = flagCodes(legacy);
    const daniFlags = flagCodes(dani);
    rows.push({
      scenarioId: scenario.id,
      legacyResponse: lastAssistant(legacy),
      daniResponse: lastAssistant(dani),
      legacyScore: legacy.daniStyle.score,
      daniScore: dani.daniStyle.score,
      flagsRemoved: legacyFlags.filter((c) => !daniFlags.includes(c)),
      flagsIntroduced: daniFlags.filter((c) => !legacyFlags.includes(c)),
      status: compareStatus(legacy.daniStyle.score, dani.daniStyle.score),
      legacyMetrics: legacy.metrics,
      daniMetrics: dani.metrics,
    });
  }
  return rows;
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

function renderCompare(rows: CompareRow[]): string {
  const lines: string[] = ["CONVERSATION STYLE COMPARE (legacy vs dani-conversation-v1)", ""];
  let legacySum = 0;
  let daniSum = 0;
  let legacyRepeated = 0;
  let daniRepeated = 0;
  let legacyKnown = 0;
  let daniKnown = 0;
  let legacyForm = 0;
  let daniForm = 0;
  let legacyMulti = 0;
  let daniMulti = 0;

  for (const row of rows) {
    legacySum += row.legacyScore;
    daniSum += row.daniScore;
    legacyRepeated += row.legacyMetrics.repeatedQuestions;
    daniRepeated += row.daniMetrics.repeatedQuestions;
    legacyKnown += row.legacyMetrics.alreadyKnownFieldQuestions;
    daniKnown += row.daniMetrics.alreadyKnownFieldQuestions;
    legacyForm += row.legacyMetrics.formLikeMessages;
    daniForm += row.daniMetrics.formLikeMessages;
    legacyMulti += row.legacyMetrics.multiQuestionMessages;
    daniMulti += row.daniMetrics.multiQuestionMessages;

    lines.push(`SCENARIO: ${row.scenarioId}`);
    lines.push(`LEGACY RESPONSE: ${row.legacyResponse}`);
    lines.push(`DANI V1 RESPONSE: ${row.daniResponse}`);
    lines.push(`LEGACY SCORE: ${row.legacyScore}`);
    lines.push(`DANI V1 SCORE: ${row.daniScore}`);
    lines.push(
      `FLAGS REMOVED: ${row.flagsRemoved.length ? row.flagsRemoved.join(", ") : "none"}`,
    );
    lines.push(
      `FLAGS INTRODUCED: ${row.flagsIntroduced.length ? row.flagsIntroduced.join(", ") : "none"}`,
    );
    lines.push(`STATUS: ${row.status}`);
    lines.push("");
  }

  const n = rows.length || 1;
  const avgL = Math.round(legacySum / n);
  const avgD = Math.round(daniSum / n);
  lines.push("IMPROVEMENT SUMMARY");
  lines.push(`Average legacy score: ${avgL}`);
  lines.push(`Average Dani score: ${avgD}`);
  lines.push(`Delta: ${avgD - avgL}`);
  lines.push(`Repeated questions legacy→Dani: ${legacyRepeated} → ${daniRepeated}`);
  lines.push(`Already-known questions legacy→Dani: ${legacyKnown} → ${daniKnown}`);
  lines.push(`Form-like messages legacy→Dani: ${legacyForm} → ${daniForm}`);
  lines.push(`Multi-question messages legacy→Dani: ${legacyMulti} → ${daniMulti}`);
  lines.push(
    `Improved: ${rows.filter((r) => r.status === "IMPROVED").map((r) => r.scenarioId).join(", ") || "none"}`,
  );
  lines.push(
    `Regressed: ${rows.filter((r) => r.status === "REGRESSED").map((r) => r.scenarioId).join(", ") || "none"}`,
  );
  lines.push(
    `Unchanged: ${rows.filter((r) => r.status === "UNCHANGED").length}`,
  );

  // Guard: no filtrar precios
  const joined = lines.join("\n");
  if (/recommendedBusiness|breakdown|hourlyRate/i.test(joined)) {
    lines.push("ERROR: price leak in compare output");
  }

  // referencia a códigos para evitar tree-shake unused en algunos bundlers
  void DaniStyleRuleCode;

  return `${lines.join("\n")}\n`;
}

const json = process.argv.includes("--json");
const rows = await compareAll();
if (json) {
  console.log(JSON.stringify({ results: rows }, null, 2));
} else {
  console.log(renderCompare(rows));
}

const severe = rows.filter(
  (r) => r.status === "REGRESSED" && r.daniScore < r.legacyScore - 15,
);
process.exit(severe.length > 0 ? 1 : 0);

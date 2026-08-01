import { validatePromptEnvelope, validateLegalActionInPrompt } from "../agents/planner/prompt-contract.js";

function meaningfulLines(prompt: string): string[] {
  return prompt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Keep first/last envelope lines intact; inject execution policy after the first line.
 */
export function buildExecutionPrompt(input: {
  persistedPrompt: string;
  stageNumber: number;
  title: string;
  workspace: string;
  mode: "READ_ONLY" | "WRITE_LIMITED";
}): { ok: true; prompt: string } | { ok: false; reason: string } {
  const lines = meaningfulLines(input.persistedPrompt);
  if (lines.length < 2) {
    return { ok: false, reason: "Persisted prompt missing envelope lines" };
  }
  const first = lines[0]!;
  const last = lines[lines.length - 1]!;
  if (first !== last) {
    return { ok: false, reason: "Persisted prompt envelope mismatch" };
  }

  const bodyLines = input.persistedPrompt.split(/\r?\n/);
  // Drop trailing empty lines for reconstruction, keep original body between envelopes.
  const firstIdx = bodyLines.findIndex((l) => l.trim().length > 0);
  let lastIdx = bodyLines.length - 1;
  while (lastIdx >= 0 && bodyLines[lastIdx]?.trim() === "") lastIdx -= 1;
  if (firstIdx < 0 || lastIdx <= firstIdx) {
    return { ok: false, reason: "Cannot locate prompt body" };
  }
  const middle = bodyLines.slice(firstIdx + 1, lastIdx).join("\n");

  const policy = [
    "",
    "DNX ORCHESTRATOR EXECUTION POLICY",
    `- Mode: ${input.mode}`,
    `- Workspace autorizado: ${input.workspace}`,
    "- No salir del workspace.",
    "- No push.",
    "- No merge.",
    "- No deploy.",
    "- No production.",
    "- No force push.",
    "- No reset --hard.",
    "- No secrets.",
    "- No MCP infra.",
    "- Preserve unrelated changes.",
    "- Do not start next stage.",
    "- Do not automatically begin the next stage.",
    "",
  ].join("\n");

  const prompt = `${first}${policy}${middle}\n${last}`;
  const envelope = validatePromptEnvelope(prompt, input.stageNumber, input.title);
  if (!envelope.ok) return { ok: false, reason: envelope.reason };
  const legal = validateLegalActionInPrompt(prompt);
  if (!legal.ok) return { ok: false, reason: legal.reason };
  return { ok: true, prompt };
}

import type { CursorRunRecord } from "../../state/types.js";
import { truncateOutput } from "../../runtime/truncate.js";
import type { CursorRunSummary } from "./types.js";

const DEFAULT_SUMMARY_CHARS = 12_000;

export function summarizeCursorRun(
  run: CursorRunRecord,
  maxResultChars: number = DEFAULT_SUMMARY_CHARS,
): CursorRunSummary {
  const raw = run.resultText ?? run.stdout ?? "";
  const truncated = truncateOutput(raw, maxResultChars);
  const outputTruncated = Boolean(run.outputTruncated) || truncated.truncated;

  let resultText = truncated.text;
  if (outputTruncated) {
    resultText = `OUTPUT_TRUNCATED=true\nNOTE: Truncated output must not be treated as complete evidence.\n\n${resultText}`;
  }

  return {
    cursorRunId: run.cursorRunId,
    status: run.status,
    mode: run.mode,
    exitCode: run.exitCode ?? null,
    durationMs: run.durationMs ?? null,
    resultText,
    outputTruncated,
    originalResultChars: truncated.originalLength,
    filesChanged: [...(run.filesChanged ?? [])],
    filesChangedCount: (run.filesChanged ?? []).length,
    gitDiffStat: truncateOutput(run.gitDiffStat ?? "", 4_000).text,
    gitStatusBefore: truncateOutput(run.gitStatusBefore ?? "", 2_000).text,
    gitStatusAfter: truncateOutput(run.gitStatusAfter ?? "", 2_000).text,
    error: run.error ?? null,
    provider: run.provider,
  };
}

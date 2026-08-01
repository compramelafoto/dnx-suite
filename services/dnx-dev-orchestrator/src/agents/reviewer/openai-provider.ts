import { Agent, run } from "@openai/agents";
import { REVIEWER_AGENT_NAME, REVIEWER_INSTRUCTIONS, buildReviewerUserMessage } from "./instructions.js";
import { ReviewDecisionSchema, type ReviewDecision } from "./schema.js";
import type { ReviewerInput } from "./types.js";
import type { OpenAiUsage } from "../planner/types.js";
import { extractUsageFromRunResult } from "../planner/usage.js";

export type OpenAiReviewerRun = {
  decision: ReviewDecision;
  usage: OpenAiUsage;
};

function assertApiKeyPresent(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_NOT_CONFIGURED");
  }
}

export function createReviewerAgent(model: string) {
  return new Agent({
    name: REVIEWER_AGENT_NAME,
    instructions: REVIEWER_INSTRUCTIONS,
    model,
    tools: [],
    outputType: ReviewDecisionSchema,
  });
}

export async function runOpenAiReviewer(
  input: ReviewerInput,
  model: string,
): Promise<OpenAiReviewerRun> {
  assertApiKeyPresent();

  const agent = createReviewerAgent(model);
  const payload = buildReviewerUserMessage(JSON.stringify(input, null, 2));
  const result = await run(agent, payload);
  const usage = extractUsageFromRunResult(result);

  const finalOutput = result.finalOutput;
  if (!finalOutput || typeof finalOutput !== "object") {
    throw new Error("Reviewer returned empty or non-object finalOutput");
  }

  const parsed = ReviewDecisionSchema.safeParse(finalOutput);
  if (!parsed.success) {
    throw new Error(`Reviewer output failed schema validation: ${parsed.error.message}`);
  }

  return { decision: parsed.data, usage };
}

export async function smokeOpenAiReviewer(model: string): Promise<{ ok: boolean; message: string }> {
  try {
    assertApiKeyPresent();
    const agent = new Agent({
      name: `${REVIEWER_AGENT_NAME} Smoke`,
      instructions: "Reply with a tiny structured review decision. No tools. No chain-of-thought.",
      model,
      tools: [],
      outputType: ReviewDecisionSchema,
    });
    const result = await run(
      agent,
      [
        "Synthetic smoke input only. No real repo.",
        'Return decision=BLOCKED, summary="smoke", evidence=["smoke"], missingEvidence=[],',
        'issues=[{severity:"ERROR",code:"SMOKE",message:"smoke",retryRecommended:false}],',
        "retryRecommended=false, nextStageRecommendation=null, taskDisposition=BLOCKED.",
      ].join(" "),
    );
    const parsed = ReviewDecisionSchema.safeParse(result.finalOutput);
    if (!parsed.success) {
      return { ok: false, message: "Smoke parse failed" };
    }
    return { ok: true, message: `Smoke OK decision=${parsed.data.decision}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}

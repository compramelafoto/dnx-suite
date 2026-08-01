import { Agent, run } from "@openai/agents";
import { PLANNER_AGENT_NAME, PLANNER_INSTRUCTIONS, buildPlannerUserMessage } from "./instructions.js";
import { PlannerDecisionSchema, type PlannerDecision } from "./schema.js";
import type { PlannerInput, OpenAiUsage } from "./types.js";
import { extractUsageFromRunResult } from "./usage.js";

export type OpenAiPlannerRun = {
  decision: PlannerDecision;
  usage: OpenAiUsage;
};

function assertApiKeyPresent(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_NOT_CONFIGURED");
  }
}

export function createPlannerAgent(model: string) {
  return new Agent({
    name: PLANNER_AGENT_NAME,
    instructions: PLANNER_INSTRUCTIONS,
    model,
    tools: [],
    outputType: PlannerDecisionSchema,
  });
}

export async function runOpenAiPlanner(
  input: PlannerInput,
  model: string,
): Promise<OpenAiPlannerRun> {
  assertApiKeyPresent();

  const agent = createPlannerAgent(model);
  const payload = buildPlannerUserMessage(JSON.stringify(input, null, 2));
  const result = await run(agent, payload);
  const usage = extractUsageFromRunResult(result);

  const finalOutput = result.finalOutput;
  if (!finalOutput || typeof finalOutput !== "object") {
    throw new Error("Planner returned empty or non-object finalOutput");
  }

  const parsed = PlannerDecisionSchema.safeParse(finalOutput);
  if (!parsed.success) {
    throw new Error(`Planner output failed schema validation: ${parsed.error.message}`);
  }

  return { decision: parsed.data, usage };
}

export async function smokeOpenAiPlanner(model: string): Promise<{ ok: boolean; message: string }> {
  try {
    assertApiKeyPresent();
    const agent = new Agent({
      name: `${PLANNER_AGENT_NAME} Smoke`,
      instructions: "Reply with a tiny structured planning decision. No tools. No chain-of-thought.",
      model,
      tools: [],
      outputType: PlannerDecisionSchema,
    });
    const result = await run(
      agent,
      'Return decision=BLOCKED, reason="smoke", stage=null for a no-op smoke check.',
    );
    const parsed = PlannerDecisionSchema.safeParse(result.finalOutput);
    if (!parsed.success) {
      return { ok: false, message: "Smoke parse failed" };
    }
    return { ok: true, message: `Smoke OK decision=${parsed.data.decision}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}

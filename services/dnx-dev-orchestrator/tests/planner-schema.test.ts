import { describe, expect, it } from "vitest";
import { PlannerDecisionSchema } from "../src/agents/planner/schema.js";
import {
  buildStageEnvelope,
  validateLegalActionInPrompt,
  validatePromptEnvelope,
} from "../src/agents/planner/prompt-contract.js";
import { validatePlannerDecision } from "../src/agents/planner/validate.js";
import { evaluateStagePlanSafety } from "../src/agents/planner/safety-gate.js";

function validStage(overrides: Record<string, unknown> = {}) {
  const title = "AUDITORIA";
  const stageNumber = 1;
  const envelope = buildStageEnvelope(stageNumber, title, "clickaton");
  const prompt = `${envelope}

Contexto: demo
Objetivo: auditar
Alcance: read-only
Acciones permitidas: READ_REPO
Acciones prohibidas: DEPLOY_PRODUCTION
Preservar cambios ajenos.
Validaciones: typecheck
Criterio de DONE: informe listo
Salida obligatoria: resumen
ACCIÓN LEGAL REQUERIDA: NO
NO comenzar automáticamente la siguiente etapa.

${envelope}`;

  return {
    stageNumber,
    title,
    objective: "Auditar",
    prompt,
    riskLevel: "LOW",
    estimatedComplexity: "LOW",
    requiresHumanApproval: false,
    allowedActions: ["READ_REPO"],
    forbiddenActions: ["DEPLOY_PRODUCTION"],
    validationCommands: ["pnpm test"],
    completionCriteria: ["Informe listo"],
    legalActionRequired: false,
    legalNotes: null,
    ...overrides,
  };
}

describe("PlannerDecisionSchema", () => {
  it("accepts valid CREATE_STAGE", () => {
    const parsed = PlannerDecisionSchema.safeParse({
      decision: "CREATE_STAGE",
      reason: "Need next stage",
      stage: validStage(),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid schema", () => {
    const parsed = PlannerDecisionSchema.safeParse({ decision: "NOPE" });
    expect(parsed.success).toBe(false);
  });

  it("CREATE_STAGE requires stage", () => {
    const parsed = PlannerDecisionSchema.safeParse({
      decision: "CREATE_STAGE",
      reason: "x",
      stage: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("COMPLETED requires stage=null", () => {
    const parsed = PlannerDecisionSchema.safeParse({
      decision: "COMPLETED",
      reason: "done",
      stage: validStage(),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("prompt envelope and legal", () => {
  it("accepts valid envelope", () => {
    const stage = validStage();
    const result = validatePromptEnvelope(stage.prompt, 1, "AUDITORIA");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid envelope", () => {
    const result = validatePromptEnvelope("solo una linea", 1, "AUDITORIA");
    expect(result.ok).toBe(false);
  });

  it("requires legal action declaration", () => {
    expect(validateLegalActionInPrompt("ACCIÓN LEGAL REQUERIDA: NO").ok).toBe(true);
    expect(validateLegalActionInPrompt("sin legal").ok).toBe(false);
  });
});

describe("safety over model output", () => {
  it("rejects forbidden allowedActions", () => {
    const stage = validStage({ allowedActions: ["DEPLOY_PRODUCTION"] });
    const result = evaluateStagePlanSafety(stage as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BLOCKED");
  });

  it("detects human approval actions", () => {
    const stage = validStage({ allowedActions: ["PUSH"] });
    const result = evaluateStagePlanSafety(stage as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HUMAN_REQUIRED");
  });

  it("CRITICAL is blocked", () => {
    const decision = validatePlannerDecision({
      decision: "CREATE_STAGE",
      reason: "risky",
      stage: validStage({ riskLevel: "CRITICAL", requiresHumanApproval: true }),
    });
    expect(decision.ok).toBe(false);
  });
});

import { z } from "zod";
import { SAFETY_ACTIONS } from "../../safety/types.js";

export const PlannerDecisionKindSchema = z.enum([
  "CREATE_STAGE",
  "RETRY_STAGE",
  "HUMAN_REQUIRED",
  "BLOCKED",
  "COMPLETED",
]);

export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const ComplexitySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const StagePlanSchema = z.object({
  stageNumber: z.number().int().positive(),
  title: z.string().min(1),
  objective: z.string().min(1),
  prompt: z.string().min(1),
  riskLevel: RiskLevelSchema,
  estimatedComplexity: ComplexitySchema,
  requiresHumanApproval: z.boolean(),
  allowedActions: z.array(z.string()),
  forbiddenActions: z.array(z.string()),
  validationCommands: z.array(z.string()),
  completionCriteria: z.array(z.string()).min(1),
  legalActionRequired: z.boolean(),
  legalNotes: z.string().nullable(),
});

export const PlannerDecisionSchema = z
  .object({
    decision: PlannerDecisionKindSchema,
    reason: z.string().min(1),
    stage: StagePlanSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    const needsStage = value.decision === "CREATE_STAGE" || value.decision === "RETRY_STAGE";
    if (needsStage && value.stage === null) {
      ctx.addIssue({
        code: "custom",
        message: `${value.decision} requires a non-null stage`,
        path: ["stage"],
      });
    }
    if (!needsStage && value.stage !== null) {
      ctx.addIssue({
        code: "custom",
        message: `${value.decision} requires stage=null`,
        path: ["stage"],
      });
    }
    if (value.decision === "COMPLETED" && value.stage !== null) {
      ctx.addIssue({
        code: "custom",
        message: "COMPLETED requires stage=null",
        path: ["stage"],
      });
    }
    if (value.decision === "HUMAN_REQUIRED" && value.stage?.requiresHumanApproval === false) {
      ctx.addIssue({
        code: "custom",
        message: "HUMAN_REQUIRED decisions must set requiresHumanApproval=true when stage is present",
        path: ["stage", "requiresHumanApproval"],
      });
    }
    if (value.stage?.riskLevel === "CRITICAL" && value.stage.requiresHumanApproval !== true) {
      ctx.addIssue({
        code: "custom",
        message: "CRITICAL risk requires requiresHumanApproval=true",
        path: ["stage", "requiresHumanApproval"],
      });
    }
  });

export type PlannerDecision = z.infer<typeof PlannerDecisionSchema>;
export type StagePlan = z.infer<typeof StagePlanSchema>;
export type PlannerDecisionKind = z.infer<typeof PlannerDecisionKindSchema>;

export const KNOWN_SAFETY_ACTION_SET = new Set<string>(SAFETY_ACTIONS);

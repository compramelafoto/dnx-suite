import { z } from "zod";

export const ReviewDecisionKindSchema = z.enum([
  "STAGE_COMPLETED",
  "RETRY_STAGE",
  "CREATE_NEXT_STAGE",
  "HUMAN_REQUIRED",
  "BLOCKED",
  "FAILED",
]);

export const IssueSeveritySchema = z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]);

export const TaskDispositionSchema = z.enum([
  "CONTINUE",
  "TASK_COMPLETED",
  "HUMAN_REQUIRED",
  "BLOCKED",
]);

export const ReviewIssueSchema = z.object({
  severity: IssueSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  retryRecommended: z.boolean(),
});

export const NextStageRecommendationSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  reason: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});

export const ReviewDecisionSchema = z
  .object({
    decision: ReviewDecisionKindSchema,
    summary: z.string().min(1),
    evidence: z.array(z.string()),
    missingEvidence: z.array(z.string()),
    issues: z.array(ReviewIssueSchema),
    retryRecommended: z.boolean(),
    nextStageRecommendation: NextStageRecommendationSchema.nullable(),
    taskDisposition: TaskDispositionSchema,
  })
  .superRefine((value, ctx) => {
    if (value.decision === "CREATE_NEXT_STAGE" && value.nextStageRecommendation === null) {
      ctx.addIssue({
        code: "custom",
        message: "CREATE_NEXT_STAGE requires nextStageRecommendation",
        path: ["nextStageRecommendation"],
      });
    }
    if (value.decision !== "CREATE_NEXT_STAGE" && value.nextStageRecommendation !== null) {
      // Allow recommendation only for CREATE_NEXT_STAGE to keep Planner ownership clear.
      ctx.addIssue({
        code: "custom",
        message: `${value.decision} requires nextStageRecommendation=null`,
        path: ["nextStageRecommendation"],
      });
    }
  });

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;
export type NextStageRecommendation = z.infer<typeof NextStageRecommendationSchema>;
export type ReviewDecisionKind = z.infer<typeof ReviewDecisionKindSchema>;
export type TaskDisposition = z.infer<typeof TaskDispositionSchema>;
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

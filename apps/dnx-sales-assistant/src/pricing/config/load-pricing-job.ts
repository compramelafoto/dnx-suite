import type { PricingConfigurationIssue } from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import {
  pricingDryRunJobSchema,
  validatePricingDryRunJob,
  type PricingDryRunJob,
} from "../job/job-schema.js";
import { loadJsonFile } from "./load-json-file.js";

export type PricingJobLoadResult =
  | { status: "READY"; value: PricingDryRunJob; warnings: PricingConfigurationIssue[] }
  | { status: "NOT_FOUND"; issues: PricingConfigurationIssue[] }
  | { status: "INVALID"; issues: PricingConfigurationIssue[] }
  | { status: "NOT_CONFIGURED"; issues: PricingConfigurationIssue[] };

export function loadPricingJobFromPath(filePath: string): PricingJobLoadResult {
  const raw = loadJsonFile(filePath);
  if (raw.status === "NOT_FOUND") {
    return { status: "NOT_FOUND", issues: raw.issues };
  }
  if (raw.status === "INVALID") {
    return { status: "INVALID", issues: raw.issues };
  }

  const parsed = pricingDryRunJobSchema.safeParse(raw.value);
  if (!parsed.success) {
    return {
      status: "INVALID",
      issues: parsed.error.issues.map((i) =>
        issue(
          PricingIssueCode.SCHEMA_INVALID,
          i.path.join(".") || "job",
          "ERROR",
          i.message,
        ),
      ),
    };
  }

  const validated = validatePricingDryRunJob(parsed.data);
  if (validated.status === "NOT_CONFIGURED") {
    return {
      status: "NOT_CONFIGURED",
      issues: validated.reasons.map((message) =>
        issue(PricingIssueCode.JOB_NOT_CONFIGURED, "job", "ERROR", message),
      ),
    };
  }
  if (validated.status === "INVALID") {
    return {
      status: "INVALID",
      issues: validated.reasons.map((message) =>
        issue(
          message.includes("UNKNOWN")
            ? PricingIssueCode.JOB_UNKNOWN_SERVICE
            : PricingIssueCode.JOB_INVALID,
          "job",
          "ERROR",
          message,
        ),
      ),
    };
  }

  return { status: "READY", value: validated.job, warnings: [] };
}

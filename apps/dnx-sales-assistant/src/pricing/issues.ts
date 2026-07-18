import type { PricingConfigurationIssue } from "./models.js";
import type { PricingIssueCode } from "./issue-codes.js";

export function issue(
  code: PricingIssueCode | string,
  path: string,
  severity: PricingConfigurationIssue["severity"],
  message: string,
): PricingConfigurationIssue {
  return { code, path, severity, message };
}

export function missingFieldsFromIssues(
  issues: PricingConfigurationIssue[],
): string[] {
  return [
    ...new Set(
      issues
        .filter((i) => i.severity === "ERROR")
        .map((i) => i.path)
        .filter(Boolean),
    ),
  ];
}

const PLACEHOLDER_RE =
  /placeholder|todo|tbd|unconfigured|rellenar|confirmar|xxx/i;

export function looksLikePlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return PLACEHOLDER_RE.test(value.trim());
}

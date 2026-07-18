import type { VisualReference } from "../domain/visual-reference.js";
import type { VisualReferenceCatalog } from "../catalog/visual-reference-catalog.js";
import {
  validateVisualReference,
  type ValidateVisualReferenceOptions,
} from "./validate-visual-reference.js";
import type { VisualReferenceValidationIssue } from "./validation-codes.js";

export function validateVisualReferenceCatalog(
  catalog: VisualReferenceCatalog,
  options?: ValidateVisualReferenceOptions,
): VisualReferenceValidationIssue[] {
  const issues: VisualReferenceValidationIssue[] = [];
  const seen = new Set<string>();

  for (const ref of catalog.references) {
    if (ref.id && seen.has(ref.id)) {
      issues.push({
        code: "VISUAL_REFERENCE_DUPLICATE_ID",
        message: `ID duplicado: ${ref.id}`,
        referenceId: ref.id,
      });
    }
    if (ref.id) seen.add(ref.id);
    issues.push(...validateVisualReference(ref, options));
  }

  return issues;
}

export function partitionValidReferences(
  references: VisualReference[],
  options?: ValidateVisualReferenceOptions,
): { valid: VisualReference[]; invalid: VisualReference[] } {
  const valid: VisualReference[] = [];
  const invalid: VisualReference[] = [];
  for (const ref of references) {
    if (
      ref.status === "APPROVED" &&
      validateVisualReference(ref, options).length === 0
    ) {
      valid.push(ref);
    } else {
      invalid.push(ref);
    }
  }
  return { valid, invalid };
}

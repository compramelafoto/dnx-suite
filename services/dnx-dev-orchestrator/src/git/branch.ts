/**
 * Sanitize a human slug for branch/path segments.
 * Allows lowercase alphanumerics and single hyphens.
 */
export function sanitizeSlug(input: string, maxLen = 48): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const clipped = normalized.slice(0, maxLen).replace(/-$/g, "");
  return clipped || "task";
}

export function buildTaskBranchName(taskId: string, project: string, objective?: string): string {
  const projectSlug = sanitizeSlug(project, 24);
  const objectiveSlug = objective ? sanitizeSlug(objective, 32) : "";
  const suffix = objectiveSlug ? `${projectSlug}-${objectiveSlug}` : projectSlug;
  const branch = `dnx-orch/${taskId}-${suffix}`;
  // Guard against path separators / dangerous chars after construction.
  if (!/^dnx-orch\/[a-z0-9][a-z0-9._/-]*[a-z0-9]$/.test(branch) && !/^dnx-orch\/[a-z0-9-]+$/.test(branch)) {
    return `dnx-orch/${taskId}-${projectSlug}`;
  }
  if (branch.includes("..") || branch.includes("//")) {
    return `dnx-orch/${taskId}-${projectSlug}`;
  }
  return branch;
}

export function validateBranchName(branch: string): { ok: true } | { ok: false; reason: string } {
  if (!branch.startsWith("dnx-orch/")) {
    return { ok: false, reason: "Branch must start with dnx-orch/" };
  }
  if (branch.includes("..") || branch.includes("//") || branch.includes("\\")) {
    return { ok: false, reason: "Branch contains illegal path segments" };
  }
  if (!/^dnx-orch\/[A-Za-z0-9._/-]+$/.test(branch)) {
    return { ok: false, reason: "Branch contains illegal characters" };
  }
  return { ok: true };
}

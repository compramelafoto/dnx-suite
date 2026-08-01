/**
 * Safe validation catalog — MODEL INTENT → CODE-MAPPED COMMAND.
 * Never: MODEL STRING → SHELL.
 *
 * ETAPA 04: catalog + ValidationRun records for tests/future runner.
 * Does not execute arbitrary planner validationCommands strings.
 */

export type SafeValidationAction =
  | { type: "TYPECHECK_PACKAGE"; package: string }
  | { type: "TEST_PACKAGE"; package: string }
  | { type: "LINT_PACKAGE"; package: string }
  | { type: "GIT_STATUS" }
  | { type: "GIT_DIFF_STAT" };

export type MappedValidationCommand = {
  action: SafeValidationAction;
  commandDisplay: string;
  argv: string[];
};

const PACKAGE_NAME_RE = /^(@[a-z0-9-]+\/)?[a-z0-9._-]+$/i;

export function isSafePackageName(name: string): boolean {
  return PACKAGE_NAME_RE.test(name) && !name.includes("..") && !name.includes(" ");
}

export function mapSafeValidationAction(action: SafeValidationAction): MappedValidationCommand | null {
  switch (action.type) {
    case "TYPECHECK_PACKAGE": {
      if (!isSafePackageName(action.package)) return null;
      return {
        action,
        commandDisplay: `pnpm --filter ${action.package} typecheck`,
        argv: ["pnpm", "--filter", action.package, "typecheck"],
      };
    }
    case "TEST_PACKAGE": {
      if (!isSafePackageName(action.package)) return null;
      return {
        action,
        commandDisplay: `pnpm --filter ${action.package} test`,
        argv: ["pnpm", "--filter", action.package, "test"],
      };
    }
    case "LINT_PACKAGE": {
      if (!isSafePackageName(action.package)) return null;
      return {
        action,
        commandDisplay: `pnpm --filter ${action.package} lint`,
        argv: ["pnpm", "--filter", action.package, "lint"],
      };
    }
    case "GIT_STATUS":
      return {
        action,
        commandDisplay: "git status --porcelain",
        argv: ["git", "status", "--porcelain"],
      };
    case "GIT_DIFF_STAT":
      return {
        action,
        commandDisplay: "git diff --stat",
        argv: ["git", "diff", "--stat"],
      };
    default:
      return null;
  }
}

/**
 * Classify planner-proposed validation strings as untrusted proposals.
 * They are NEVER executed directly.
 */
export function classifyProposedValidationCommand(command: string): {
  trusted: false;
  note: string;
  looksFamiliar: boolean;
} {
  const normalized = command.trim().toLowerCase();
  const looksFamiliar =
    normalized === "git status" ||
    normalized === "git status --porcelain" ||
    normalized === "git diff --stat" ||
    normalized === "npx tsc --noemit" ||
    normalized.startsWith("pnpm ") ||
    normalized.startsWith("npm test") ||
    normalized.startsWith("pnpm test") ||
    normalized.startsWith("pnpm lint") ||
    normalized.startsWith("pnpm typecheck");

  return {
    trusted: false,
    note: "Planner validationCommands are proposals only — never executed as raw shell strings.",
    looksFamiliar,
  };
}

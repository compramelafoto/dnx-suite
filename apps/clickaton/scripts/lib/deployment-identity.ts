export type DeploymentIdentityInput = {
  projectName?: string;
  projectId?: string;
  gitBranch?: string;
  domains?: string[];
  expectedProject: string;
  expectedProductEnvironment: "staging" | "production";
  expectedBranch?: string;
  forbiddenDomain?: string;
};

export type DeploymentIdentityResult = {
  status: "PASS" | "FAIL";
  productEnvironment: "staging" | "production" | "unknown";
  reasons: string[];
  checks: Record<string, { ok: boolean; detail?: string }>;
};

const STAGING_PROJECT = "clickaton-staging";
const PROD_PROJECT = "clickaton-dnxsuite";
const PROD_DOMAIN = "maratonfotografica.com";

export function evaluateDeploymentIdentity(
  input: DeploymentIdentityInput,
): DeploymentIdentityResult {
  const reasons: string[] = [];
  const checks: DeploymentIdentityResult["checks"] = {};
  const project = (input.projectName ?? "").trim();
  const expected = input.expectedProject.trim();
  const productEnv = input.expectedProductEnvironment;
  const forbidden = (
    input.forbiddenDomain ?? PROD_DOMAIN
  ).trim().toLowerCase();
  const domains = (input.domains ?? []).map((d) => d.toLowerCase());

  checks.projectName = {
    ok: project === expected,
    detail: `got=${project || "absent"} expected=${expected}`,
  };
  if (!checks.projectName.ok) reasons.push("project_name_mismatch");

  if (productEnv === "staging") {
    checks.notProductionProject = {
      ok: project !== PROD_PROJECT,
      detail: project === PROD_PROJECT ? "clickaton-dnxsuite_forbidden" : "ok",
    };
    if (!checks.notProductionProject.ok) {
      reasons.push("staging_target_is_production_project");
    }
    checks.forbiddenDomainAbsent = {
      ok: !domains.some((d) => d === forbidden || d.endsWith(`.${forbidden}`)),
      detail: domains.includes(forbidden) ? "production_domain_present" : "ok",
    };
    if (!checks.forbiddenDomainAbsent.ok) {
      reasons.push("staging_has_forbidden_domain");
    }
    if (input.expectedBranch) {
      checks.branch = {
        ok: (input.gitBranch ?? "") === input.expectedBranch,
        detail: `got=${input.gitBranch ?? "absent"} expected=${input.expectedBranch}`,
      };
      if (!checks.branch.ok) reasons.push("branch_mismatch");
    }
  }

  if (productEnv === "production") {
    checks.productionProject = {
      ok: project === PROD_PROJECT,
      detail: project,
    };
    if (!checks.productionProject.ok) reasons.push("not_production_project");
  }

  if (input.projectId) {
    checks.projectIdPresent = { ok: true, detail: `${input.projectId.slice(0, 12)}***` };
  }

  const status = reasons.length === 0 ? "PASS" : "FAIL";
  return {
    status,
    productEnvironment: productEnv,
    reasons,
    checks,
  };
}

export const DEPLOYMENT_IDENTITY_DEFAULTS = {
  stagingProject: STAGING_PROJECT,
  productionProject: PROD_PROJECT,
  forbiddenDomain: PROD_DOMAIN,
  stagingBranch: "migration-legacy-clf-to-monorepo",
  productionBranch: "main",
} as const;

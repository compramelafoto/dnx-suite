/**
 * Guard read-only de identidad de deploy Clickatón.
 *
 *   pnpm --filter clickaton deployment:identity
 *
 * Lee apps/clickaton/.vercel/project.json. No modifica Vercel.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  DEPLOYMENT_IDENTITY_DEFAULTS,
  evaluateDeploymentIdentity,
} from "./lib/deployment-identity";

function readLocalLink(): { projectId?: string; projectName?: string; orgId?: string } {
  const path = join(process.cwd(), ".vercel", "project.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as {
    projectId?: string;
    projectName?: string;
    orgId?: string;
  };
}

function currentGitBranch(): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
}

function main() {
  const link = readLocalLink();
  const expectedProject =
    process.env.CLICKATON_EXPECTED_VERCEL_PROJECT?.trim() ||
    DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject;
  const expectedProductEnvironment = (
    process.env.CLICKATON_EXPECTED_PRODUCT_ENVIRONMENT?.trim() || "staging"
  ).toLowerCase() as "staging" | "production";
  const expectedBranch =
    process.env.CLICKATON_EXPECTED_BRANCH?.trim() ||
    (expectedProductEnvironment === "staging"
      ? DEPLOYMENT_IDENTITY_DEFAULTS.stagingBranch
      : DEPLOYMENT_IDENTITY_DEFAULTS.productionBranch);
  const forbiddenDomain =
    process.env.CLICKATON_FORBIDDEN_DOMAIN?.trim() ||
    DEPLOYMENT_IDENTITY_DEFAULTS.forbiddenDomain;
  const gitBranch =
    process.env.CLICKATON_GIT_BRANCH?.trim() || currentGitBranch();

  const result = evaluateDeploymentIdentity({
    projectName: link.projectName,
    projectId: link.projectId,
    gitBranch,
    domains:
      expectedProductEnvironment === "staging"
        ? ["clickaton-staging.vercel.app"]
        : ["maratonfotografica.com"],
    expectedProject,
    expectedProductEnvironment,
    expectedBranch,
    forbiddenDomain,
  });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        warning:
          "NO ASUMIR QUE UN DEPLOYMENT PRODUCTION DE VERCEL PERTENECE AL PRODUCTO REAL. VERIFICAR SIEMPRE PROJECT ID Y DOMAIN.",
        localLink: {
          projectName: link.projectName ?? null,
          projectId: link.projectId
            ? `${link.projectId.slice(0, 12)}***`
            : null,
          orgId: link.orgId ? `${link.orgId.slice(0, 10)}***` : null,
        },
        gitBranch: gitBranch ?? null,
        expected: {
          project: expectedProject,
          productEnvironment: expectedProductEnvironment,
          branch: expectedBranch,
          forbiddenDomain,
        },
        checks: result.checks,
        reasons: result.reasons,
        rootVercelWarning:
          "Repo root .vercel may link clickaton-dnxsuite — never deploy from monorepo root without explicit relink.",
      },
      null,
      2,
    ),
  );
  if (result.status !== "PASS") process.exit(1);
}

main();

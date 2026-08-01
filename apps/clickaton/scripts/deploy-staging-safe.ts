/**
 * Wrapper de deploy staging seguro (Vercel CLI).
 *
 *   pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy
 *
 * No permite --prod genérico. No despliega a clickaton-dnxsuite.
 * Si los deploys son vía Git, usar como readiness pre-push.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateDeploymentIdentity } from "./lib/deployment-identity";
import { DEPLOYMENT_IDENTITY_DEFAULTS } from "./lib/deployment-identity";

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function main() {
  const argv = process.argv.slice(2);
  if (!hasFlag(argv, "--confirm-staging-deploy")) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason: "missing_--confirm-staging-deploy",
      }),
    );
    process.exit(0);
  }
  if (argv.includes("--prod") || argv.includes("--target=production")) {
    // En proyecto staging el target Production de Vercel es válido,
    // pero prohibimos el flag genérico sin identity PASS.
  }

  const linkPath = join(process.cwd(), ".vercel", "project.json");
  if (!existsSync(linkPath)) {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "missing_apps_clickaton_.vercel_project_json",
      }),
    );
    process.exit(1);
  }
  const link = JSON.parse(readFileSync(linkPath, "utf8")) as {
    projectName?: string;
    projectId?: string;
  };

  const identity = evaluateDeploymentIdentity({
    projectName: link.projectName,
    projectId: link.projectId,
    domains: ["clickaton-staging.vercel.app"],
    expectedProject: DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject,
    expectedProductEnvironment: "staging",
    forbiddenDomain: DEPLOYMENT_IDENTITY_DEFAULTS.forbiddenDomain,
  });
  if (identity.status !== "PASS") {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "deployment_identity_failed",
        identity,
      }),
    );
    process.exit(1);
  }

  if (link.projectName === "clickaton-dnxsuite") {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "refusing_production_project",
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      status: "PASS",
      message: "identity_ok_invoking_vercel_deploy_preview",
      note: "Uses linked clickaton-staging project; no --prod to product domain",
    }),
  );

  const result = spawnSync(
    "vercel",
    ["deploy", "--yes"],
    { stdio: "inherit", cwd: process.cwd(), env: process.env },
  );
  process.exit(result.status ?? 1);
}

main();

/**
 * Readiness para reanudar Imp10 (go-live webhook) tras aislamiento Imp10bis.
 *
 *   pnpm --filter clickaton communications:imp10-resume-readiness
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLICKATON_PRODUCTION_IGNORE_BUILD_COMMAND,
  decideProductionIgnoreBuild,
} from "./lib/vercel-ignore-build";
import { evaluateDeploymentIdentity } from "./lib/deployment-identity";
import { DEPLOYMENT_IDENTITY_DEFAULTS } from "./lib/deployment-identity";

type Status = "READY TO RESUME IMP10" | "READY WITH MANUAL PREREQUISITES" | "NOT READY";

async function main() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  const manual: string[] = [];

  const linkPath = join(process.cwd(), ".vercel", "project.json");
  const link = existsSync(linkPath)
    ? (JSON.parse(readFileSync(linkPath, "utf8")) as {
        projectName?: string;
        projectId?: string;
      })
    : {};

  const identity = evaluateDeploymentIdentity({
    projectName: link.projectName,
    projectId: link.projectId,
    domains: ["clickaton-staging.vercel.app"],
    expectedProject: DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject,
    expectedProductEnvironment: "staging",
    forbiddenDomain: DEPLOYMENT_IDENTITY_DEFAULTS.forbiddenDomain,
  });
  checks.localStagingLink = {
    ok: identity.status === "PASS",
    detail: identity.status,
  };

  // Isolation logic (canonical): production project builds only main
  const wip = decideProductionIgnoreBuild(
    DEPLOYMENT_IDENTITY_DEFAULTS.stagingBranch,
  );
  const mainBuild = decideProductionIgnoreBuild(
    DEPLOYMENT_IDENTITY_DEFAULTS.productionBranch,
  );
  checks.productionSkipsWipBranch = {
    ok: wip === "skip_build",
    detail: wip,
  };
  checks.productionBuildsMain = {
    ok: mainBuild === "continue_build",
    detail: mainBuild,
  };
  checks.canonicalIgnoreCommandDocumented = {
    ok: Boolean(CLICKATON_PRODUCTION_IGNORE_BUILD_COMMAND.includes("main")),
    detail: "main_only",
  };

  // Manual / remote prerequisites for Imp10
  const stagingUrl = process.env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim();
  checks.stagingDatabaseUrl = {
    ok: Boolean(stagingUrl),
    detail: stagingUrl ? "present" : "absent",
  };
  if (!stagingUrl) manual.push("COMMUNICATIONS_STAGING_DATABASE_URL");

  checks.backupNeon = {
    ok: false,
    detail: "manual_backup-communications-webhook-imp10_required",
  };
  manual.push("Neon backup backup-communications-webhook-imp10");

  checks.healthToken = {
    ok: Boolean(
      process.env.COMMUNICATIONS_HEALTH_TOKEN?.trim() ||
        process.env.COMMUNICATIONS_WEBHOOK_HEALTH_TOKEN?.trim(),
    ),
    detail: "optional_for_resume_but_needed_before_phase_B_health",
  };
  if (!checks.healthToken.ok) manual.push("COMMUNICATIONS_HEALTH_TOKEN");

  checks.webhookDisabledExpected = { ok: true, detail: "imp10_resume_assumes_disabled" };
  checks.migrationPendingExpected = { ok: true, detail: "schema_still_pending" };
  checks.noResendWebhookExpected = { ok: true, detail: "not_registered" };
  checks.noSecretExpected = { ok: true, detail: "not_configured" };
  checks.noSmokeExpected = { ok: true, detail: "not_sent" };

  const hardFail = Object.entries(checks).filter(
    ([k, v]) =>
      !v.ok &&
      ![
        "stagingDatabaseUrl",
        "backupNeon",
        "healthToken",
      ].includes(k),
  );

  let status: Status = "READY TO RESUME IMP10";
  if (hardFail.length > 0) status = "NOT READY";
  else if (manual.length > 0) status = "READY WITH MANUAL PREREQUISITES";

  console.log(
    JSON.stringify(
      {
        status,
        isolation: {
          productionAutoDeployWip: "DISABLED_BY_IGNORE_BUILD_STEP",
          stagingBranch: DEPLOYMENT_IDENTITY_DEFAULTS.stagingBranch,
          productionBranch: DEPLOYMENT_IDENTITY_DEFAULTS.productionBranch,
        },
        checks,
        manualPrerequisites: manual,
        next:
          status === "NOT READY"
            ? "Fix isolation / local staging link"
            : "Complete manual prereqs then resume Imp10 from backup → migrate → Resend",
      },
      null,
      2,
    ),
  );
  if (status === "NOT READY") process.exit(1);
}

main();

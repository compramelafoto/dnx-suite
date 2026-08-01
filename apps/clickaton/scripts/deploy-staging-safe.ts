/**
 * Wrapper de deploy staging seguro (Vercel CLI).
 *
 *   pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy
 *
 * Aborta si el target no es clickaton-staging (incluye clickaton-dnxsuite).
 * No hace commit ni push. No modifica producción.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertStagingVercelTarget } from "./lib/assert-staging-vercel-target";

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
        usage:
          "pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy",
      }),
    );
    process.exit(0);
  }

  const guard = assertStagingVercelTarget({ cwd: process.cwd() });
  if (!guard.ok) {
    console.error(guard.abortMessage);
    console.error(JSON.stringify({ status: "FAIL", details: guard.details }, null, 2));
    process.exit(1);
  }

  // Forzar project id staging aunque exista ambigüedad en el entorno.
  const env = {
    ...process.env,
    VERCEL_PROJECT_ID: guard.projectId,
    VERCEL_ORG_ID:
      process.env.VERCEL_ORG_ID?.trim() || "team_fygF3LmWq2H8oEGuDtoCMgxb",
  };

  // Project Root Directory in Vercel is `apps/clickaton`, so the CLI must run
  // from the monorepo root. VERCEL_PROJECT_ID/ORG_ID override any root `.vercel`
  // link (which may point at clickaton-dnxsuite).
  const appCwd = process.cwd();
  const repoRoot = resolve(appCwd, "../..");
  const deployCwd = existsSync(join(repoRoot, "apps/clickaton/package.json"))
    ? repoRoot
    : appCwd;

  console.log(
    JSON.stringify({
      status: "PASS",
      message: "staging_target_confirmed",
      projectName: guard.projectName,
      projectIdPrefix: `${guard.projectId.slice(0, 12)}***`,
      linkPath: guard.linkPath,
      deployCwd,
      note: "Invoking vercel deploy --prod on clickaton-staging only (product staging alias).",
    }),
  );

  const result = spawnSync(
    "vercel",
    ["deploy", "--prod", "--yes"],
    { stdio: "inherit", cwd: deployCwd, env },
  );
  process.exit(result.status ?? 1);
}

main();

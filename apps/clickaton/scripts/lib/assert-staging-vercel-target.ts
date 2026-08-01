/**
 * Aborta si el target Vercel no es clickaton-staging.
 * Usado por deploy:staging:safe y checks pre-deploy.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  DEPLOYMENT_IDENTITY_DEFAULTS,
  evaluateDeploymentIdentity,
} from "./deployment-identity";

export const CLICKATON_STAGING_PROJECT_ID =
  "prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa";
export const CLICKATON_PRODUCTION_PROJECT_ID =
  "prj_wo7NXldJbGlkklHnxPjRtdd9xDn0";

export type StagingDeployGuardResult =
  | { ok: true; projectName: string; projectId: string; linkPath: string }
  | { ok: false; abortMessage: string; details: Record<string, unknown> };

function readJson(path: string): { projectName?: string; projectId?: string } {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as {
      projectName?: string;
      projectId?: string;
    };
  } catch {
    return {};
  }
}

/**
 * Resuelve el link Vercel a usar: prioriza apps/clickaton/.vercel,
 * y rechaza explícitamente el link de la raíz del monorepo si apunta a producción.
 */
export function assertStagingVercelTarget(options?: {
  cwd?: string;
  envProjectId?: string | null;
  envProjectName?: string | null;
}): StagingDeployGuardResult {
  const cwd = options?.cwd ?? process.cwd();
  const appLink = join(cwd, ".vercel", "project.json");
  const repoRootLink = resolve(cwd, "../../.vercel/project.json");
  const fromAppsClickaton = cwd.endsWith(`${join("apps", "clickaton")}`)
    ? appLink
    : join(cwd, "apps/clickaton/.vercel/project.json");

  const candidates = [appLink, fromAppsClickaton].filter(
    (p, i, arr) => arr.indexOf(p) === i,
  );

  let linkPath = "";
  let link: { projectName?: string; projectId?: string } = {};
  for (const p of candidates) {
    if (existsSync(p)) {
      linkPath = p;
      link = readJson(p);
      break;
    }
  }

  const envId = (options?.envProjectId ?? process.env.VERCEL_PROJECT_ID ?? "").trim();
  const envName = (
    options?.envProjectName ??
    process.env.VERCEL_PROJECT_NAME ??
    process.env.CLICKATON_EXPECTED_VERCEL_PROJECT ??
    ""
  ).trim();

  const projectId = (envId || link.projectId || "").trim();
  const projectName = (envName || link.projectName || "").trim();

  if (existsSync(repoRootLink) && cwd.includes("apps/clickaton") === false) {
    const root = readJson(repoRootLink);
    if (
      root.projectName === DEPLOYMENT_IDENTITY_DEFAULTS.productionProject ||
      root.projectId === CLICKATON_PRODUCTION_PROJECT_ID
    ) {
      // Solo aborta si además el target efectivo no es staging.
      if (
        projectName !== DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject &&
        projectId !== CLICKATON_STAGING_PROJECT_ID
      ) {
        return {
          ok: false,
          abortMessage:
            "DEPLOY ABORTED: expected clickaton-staging, received clickaton-dnxsuite (repo root .vercel)",
          details: {
            reason: "root_vercel_links_production",
            hint: "Deploy from apps/clickaton with linked staging, or set VERCEL_PROJECT_ID to staging.",
          },
        };
      }
    }
  }

  if (
    projectName === DEPLOYMENT_IDENTITY_DEFAULTS.productionProject ||
    projectId === CLICKATON_PRODUCTION_PROJECT_ID
  ) {
    return {
      ok: false,
      abortMessage:
        "DEPLOY ABORTED: expected clickaton-staging, received clickaton-dnxsuite",
      details: {
        projectName: projectName || null,
        projectIdPrefix: projectId ? `${projectId.slice(0, 12)}***` : null,
        linkPath: linkPath || null,
      },
    };
  }

  const identity = evaluateDeploymentIdentity({
    projectName:
      projectName || DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject,
    projectId: projectId || undefined,
    domains: ["clickaton-staging.vercel.app"],
    expectedProject: DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject,
    expectedProductEnvironment: "staging",
    forbiddenDomain: DEPLOYMENT_IDENTITY_DEFAULTS.forbiddenDomain,
  });

  if (projectName && projectName !== DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject) {
    return {
      ok: false,
      abortMessage: `DEPLOY ABORTED: expected clickaton-staging, received ${projectName}`,
      details: { identity },
    };
  }

  if (projectId && projectId !== CLICKATON_STAGING_PROJECT_ID) {
    return {
      ok: false,
      abortMessage:
        "DEPLOY ABORTED: expected clickaton-staging, received unexpected project id",
      details: {
        projectIdPrefix: `${projectId.slice(0, 12)}***`,
        expectedPrefix: `${CLICKATON_STAGING_PROJECT_ID.slice(0, 12)}***`,
      },
    };
  }

  if (!projectName && !projectId) {
    return {
      ok: false,
      abortMessage:
        "DEPLOY ABORTED: expected clickaton-staging, received absent project link",
      details: { candidates },
    };
  }

  if (identity.status !== "PASS" && projectName) {
    return {
      ok: false,
      abortMessage: `DEPLOY ABORTED: expected clickaton-staging, received ${projectName || "unknown"}`,
      details: { identity },
    };
  }

  return {
    ok: true,
    projectName: projectName || DEPLOYMENT_IDENTITY_DEFAULTS.stagingProject,
    projectId: projectId || CLICKATON_STAGING_PROJECT_ID,
    linkPath: linkPath || "(env)",
  };
}

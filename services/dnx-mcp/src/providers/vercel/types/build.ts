import type { VercelDeployment } from "./deployment.js";

export type DeploymentHealth = "healthy" | "building" | "failed" | "canceled" | "unknown";

export interface BuildInfo {
  deploymentId: string;
  state: string;
  durationMs: number | null;
  commitSha: string | null;
  commitMessage: string | null;
  author: string | null;
  branch: string | null;
  url: string | null;
  createdAt: number | null;
  readyAt: number | null;
}

export function extractBuildInfo(deployment: VercelDeployment): BuildInfo {
  const state = deployment.readyState ?? deployment.state ?? "unknown";
  const buildingAt = deployment.buildingAt ?? deployment.createdAt ?? null;
  const readyAt = deployment.ready ?? null;
  const durationMs =
    buildingAt !== null && readyAt !== null ? Math.max(0, readyAt - buildingAt) : null;

  const meta = deployment.meta ?? {};

  return {
    deploymentId: deployment.id,
    state,
    durationMs,
    commitSha: meta.githubCommitSha ?? meta.gitlabCommitSha ?? meta.bitbucketCommitSha ?? null,
    commitMessage: meta.githubCommitMessage ?? null,
    author: meta.githubCommitAuthorName ?? null,
    branch: meta.githubCommitRef ?? meta.gitlabCommitRef ?? meta.bitbucketCommitRef ?? null,
    url: deployment.url ?? null,
    createdAt: deployment.createdAt ?? null,
    readyAt,
  };
}

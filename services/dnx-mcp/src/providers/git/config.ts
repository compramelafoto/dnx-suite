import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { loadEnv } from "../../config/index.js";

export const gitConfigSchema = z.object({
  repoPath: z.string().min(1),
  binary: z.string().min(1).default("git"),
  defaultBranch: z.string().min(1).optional(),
});

export type GitConfig = z.infer<typeof gitConfigSchema>;

export const defaultGitConfig: GitConfig = {
  repoPath: process.cwd(),
  binary: "git",
};

export function resolveGitConfig(overrides: Partial<GitConfig> = {}): GitConfig {
  const env = loadEnv();

  const repoPath = overrides.repoPath ?? env.GIT_REPO_PATH ?? process.cwd();
  const resolvedPath = resolve(repoPath);

  return gitConfigSchema.parse({
    repoPath: resolvedPath,
    binary: overrides.binary ?? env.GIT_BINARY ?? "git",
    defaultBranch: overrides.defaultBranch ?? env.GIT_DEFAULT_BRANCH,
  });
}

export function isRepoPathAccessible(repoPath: string): boolean {
  return existsSync(repoPath);
}

import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const gitCommitSchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  author: z.string(),
  email: z.string().optional(),
  date: z.string(),
  subject: z.string(),
});

export type GitCommit = z.infer<typeof gitCommitSchema>;

export const gitRemoteSchema = z.object({
  name: z.string(),
  fetchUrl: z.string(),
  pushUrl: z.string().optional(),
});

export type GitRemote = z.infer<typeof gitRemoteSchema>;

export const gitStatusSchema = z.object({
  branch: z.string(),
  dirty: z.boolean(),
  staged: z.array(z.string()),
  unstaged: z.array(z.string()),
  untracked: z.array(z.string()),
});

export type GitStatus = z.infer<typeof gitStatusSchema>;

export const gitDiffStatSchema = z.object({
  filesChanged: z.number(),
  insertions: z.number(),
  deletions: z.number(),
  summary: z.string(),
});

export type GitDiffStat = z.infer<typeof gitDiffStatSchema>;

export const gitBranchCompareSchema = z.object({
  base: z.string(),
  head: z.string(),
  commits: z.array(gitCommitSchema),
  diffStat: gitDiffStatSchema,
  changedFiles: z.array(z.string()),
});

export type GitBranchCompare = z.infer<typeof gitBranchCompareSchema>;

export const aheadBehindSchema = z.object({
  ahead: z.number(),
  behind: z.number(),
  upstream: z.string().nullable(),
});

export type AheadBehind = z.infer<typeof aheadBehindSchema>;

export const releaseSummarySchema = z.object({
  branch: z.string(),
  headCommit: gitCommitSchema,
  latestTag: z.string().nullable(),
  dirty: z.boolean(),
  unpushedCommits: z.number(),
  aheadBehind: aheadBehindSchema.nullable(),
  changedFilesCount: z.number(),
  defaultBranch: z.string().nullable(),
  onDefaultBranch: z.boolean(),
});

export type ReleaseSummary = z.infer<typeof releaseSummarySchema>;

export const releaseReadinessSchema = z.object({
  branch: z.string(),
  dirtyTree: z.boolean(),
  unpushedCommits: z.number(),
  changedFiles: z.array(z.string()),
  lastCommit: gitCommitSchema,
  latestTag: z.string().nullable(),
  riskLevel: riskLevelSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendation: z.string(),
});

export type ReleaseReadiness = z.infer<typeof releaseReadinessSchema>;

export const compareBranchesInputSchema = z.object({
  base: z.string().min(1),
  head: z.string().min(1),
});

export type CompareBranchesInput = z.infer<typeof compareBranchesInputSchema>;

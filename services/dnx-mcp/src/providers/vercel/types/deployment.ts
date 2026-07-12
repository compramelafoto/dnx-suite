import { z } from "zod";
import { paginationSchema } from "./common.js";

export const vercelDeploymentMetaSchema = z
  .object({
    githubCommitSha: z.string().optional(),
    githubCommitMessage: z.string().optional(),
    githubCommitAuthorName: z.string().optional(),
    githubCommitAuthorEmail: z.string().optional(),
    githubCommitRef: z.string().optional(),
    gitlabCommitSha: z.string().optional(),
    gitlabCommitRef: z.string().optional(),
    bitbucketCommitSha: z.string().optional(),
    bitbucketCommitRef: z.string().optional(),
    branchAlias: z.string().optional(),
  })
  .passthrough();

export const vercelDeploymentSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string().optional(),
  meta: vercelDeploymentMetaSchema.optional(),
  target: z.enum(["production", "preview", "development"]).nullable().optional(),
  state: z.enum(["BUILDING", "ERROR", "INITIALIZING", "QUEUED", "READY", "CANCELED"]).optional(),
  readyState: z
    .enum(["BUILDING", "ERROR", "INITIALIZING", "QUEUED", "READY", "CANCELED"])
    .optional(),
  createdAt: z.number().optional(),
  buildingAt: z.number().optional(),
  ready: z.number().optional(),
  creator: z
    .object({
      uid: z.string().optional(),
      username: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  projectId: z.string().optional(),
  alias: z.array(z.string()).optional(),
  aliasAssigned: z.boolean().optional(),
  inspectorUrl: z.string().optional(),
});

export const vercelDeploymentsResponseSchema = z.object({
  deployments: z.array(vercelDeploymentSchema),
  pagination: paginationSchema.optional(),
});

const vercelDeploymentAliasEntrySchema = z.union([
  z.string(),
  z
    .object({
      alias: z.string(),
      uid: z.string().optional(),
    })
    .passthrough(),
]);

export const vercelDeploymentAliasSchema = z
  .object({
    alias: z.array(z.string()).optional(),
    aliases: z.array(vercelDeploymentAliasEntrySchema).optional(),
    uid: z.string().optional(),
  })
  .passthrough();

export type VercelDeployment = z.infer<typeof vercelDeploymentSchema>;
export type VercelDeploymentMeta = z.infer<typeof vercelDeploymentMetaSchema>;
export type VercelDeploymentsResponse = z.infer<typeof vercelDeploymentsResponseSchema>;

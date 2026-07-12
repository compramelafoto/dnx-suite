import { z } from "zod";
import { paginationSchema } from "./common.js";

export const vercelProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  framework: z.string().nullable().optional(),
  nodeVersion: z.string().optional(),
  link: z
    .object({
      type: z.string().optional(),
      repo: z.string().optional(),
      repoId: z.number().optional(),
      productionBranch: z.string().optional(),
    })
    .nullable()
    .optional(),
  latestDeployments: z
    .array(
      z.object({
        id: z.string(),
        url: z.string().optional(),
        createdAt: z.number().optional(),
        target: z.string().nullable().optional(),
        readyState: z.string().optional(),
      }),
    )
    .optional(),
  targets: z
    .record(
      z.string(),
      z
        .object({
          id: z.string().optional(),
          url: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
  alias: z
    .array(
      z.object({
        domain: z.string(),
        deployment: z.string().optional(),
        target: z.string().optional(),
        environment: z.string().optional(),
      }),
    )
    .optional(),
});

export const vercelProjectsResponseSchema = z.object({
  projects: z.array(vercelProjectSchema),
  pagination: paginationSchema.optional(),
});

export type VercelProject = z.infer<typeof vercelProjectSchema>;
export type VercelProjectsResponse = z.infer<typeof vercelProjectsResponseSchema>;

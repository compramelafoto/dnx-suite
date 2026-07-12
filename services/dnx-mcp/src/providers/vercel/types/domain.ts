import { z } from "zod";
import { paginationSchema } from "./common.js";

export const vercelDomainVerificationSchema = z.object({
  type: z.string(),
  domain: z.string(),
  value: z.string(),
  reason: z.string().optional(),
});

export const vercelProjectDomainSchema = z.object({
  name: z.string(),
  apexName: z.string().optional(),
  projectId: z.string().optional(),
  verified: z.boolean().optional(),
  verification: z.array(vercelDomainVerificationSchema).optional(),
  gitBranch: z.string().nullable().optional(),
  redirect: z.string().nullable().optional(),
  redirectStatusCode: z.number().nullable().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const vercelProjectDomainsResponseSchema = z.object({
  domains: z.array(vercelProjectDomainSchema),
  pagination: paginationSchema.optional(),
});

export const vercelDomainConfigSchema = z.object({
  configuredBy: z.string().nullable().optional(),
  misconfigured: z.boolean().optional(),
  acceptedChallenges: z.array(z.string()).optional(),
});

export type VercelProjectDomain = z.infer<typeof vercelProjectDomainSchema>;
export type VercelDomainVerification = z.infer<typeof vercelDomainVerificationSchema>;

export interface AddDomainInput {
  name: string;
  gitBranch?: string;
  redirect?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
}

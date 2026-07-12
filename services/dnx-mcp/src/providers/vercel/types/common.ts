import { z } from "zod";

export const paginationSchema = z.object({
  count: z.number().optional(),
  next: z.number().nullable().optional(),
  prev: z.number().nullable().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export type DeploymentTarget = "production" | "preview" | "development";

export type DeploymentState =
  "BUILDING" | "ERROR" | "INITIALIZING" | "QUEUED" | "READY" | "CANCELED";

export type EnvTarget = "production" | "preview" | "development";

export type EnvType = "plain" | "secret" | "encrypted" | "system";

export interface ListOptions {
  limit?: number;
  since?: number;
  until?: number;
}

export interface TeamScope {
  teamId?: string;
  teamSlug?: string;
}

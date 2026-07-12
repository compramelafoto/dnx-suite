import { z } from "zod";

export const vercelEnvVarSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  value: z.string().optional(),
  type: z.enum(["plain", "secret", "encrypted", "system"]).optional(),
  target: z.array(z.enum(["production", "preview", "development"])).optional(),
  gitBranch: z.string().nullable().optional(),
  configurationId: z.string().nullable().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
  decrypted: z.boolean().optional(),
});

export const vercelEnvVarsResponseSchema = z
  .object({
    envs: z.array(vercelEnvVarSchema),
  })
  .passthrough();

export type VercelEnvVar = z.infer<typeof vercelEnvVarSchema>;

export interface CreateEnvVarInput {
  key: string;
  value: string;
  type?: "plain" | "secret" | "encrypted";
  target: Array<"production" | "preview" | "development">;
  gitBranch?: string;
}

export interface UpdateEnvVarInput {
  key?: string;
  value?: string;
  type?: "plain" | "secret" | "encrypted";
  target?: Array<"production" | "preview" | "development">;
  gitBranch?: string | null;
}

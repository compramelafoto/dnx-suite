import { z } from "zod";

export const vercelConfigSchema = z.object({
  token: z.string(),
  teamId: z.string().optional(),
  teamSlug: z.string().optional(),
  baseUrl: z.string().url().default("https://api.vercel.com"),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryBaseDelayMs: z.number().int().min(50).default(500),
  requestsPerMinute: z.number().int().min(1).default(100),
});

export const vercelConfigInputSchema = vercelConfigSchema.partial({ token: true });

export type VercelConfig = z.infer<typeof vercelConfigSchema>;

export const defaultVercelConfig = {
  baseUrl: "https://api.vercel.com",
  maxRetries: 3,
  retryBaseDelayMs: 500,
  requestsPerMinute: 100,
} as const;

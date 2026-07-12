import { z } from "zod";

export const vercelUserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().nullable().optional(),
  username: z.string().optional(),
  avatar: z.string().nullable().optional(),
});

export const vercelTeamSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string().optional(),
  avatar: z.string().nullable().optional(),
  createdAt: z.number().optional(),
  membership: z
    .object({
      role: z.string().optional(),
      confirmed: z.boolean().optional(),
    })
    .optional(),
});

export const vercelTeamsResponseSchema = z.object({
  teams: z.array(vercelTeamSchema),
});

export type VercelUser = z.infer<typeof vercelUserSchema>;
export type VercelTeam = z.infer<typeof vercelTeamSchema>;

import { z } from "zod";

export const vercelLogEventSchema = z.object({
  type: z.string(),
  created: z.number().optional(),
  payload: z
    .object({
      text: z.string().optional(),
      id: z.string().optional(),
      date: z.number().optional(),
      deploymentId: z.string().optional(),
      source: z.string().optional(),
      projectId: z.string().optional(),
      level: z.string().optional(),
      message: z.string().optional(),
      requestId: z.string().optional(),
      statusCode: z.number().optional(),
      destination: z.string().optional(),
      path: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const vercelLogEventsResponseSchema = z.object({
  events: z.array(vercelLogEventSchema).optional(),
});

export function parseVercelLogEvents(response: unknown): VercelLogEvent[] {
  if (Array.isArray(response)) {
    return z.array(vercelLogEventSchema).parse(response);
  }
  return vercelLogEventsResponseSchema.parse(response).events ?? [];
}

export type VercelLogEvent = z.infer<typeof vercelLogEventSchema>;
export type LogSource = "build" | "runtime" | "edge";

export interface GetLogsOptions {
  limit?: number;
  since?: number;
  until?: number;
  direction?: "forward" | "backward";
  follow?: boolean;
}

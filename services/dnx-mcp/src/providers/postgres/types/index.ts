import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const activeQuerySchema = z.object({
  pid: z.number(),
  usename: z.string().nullable(),
  applicationName: z.string().nullable(),
  state: z.string().nullable(),
  query: z.string().nullable(),
  queryStart: z.string().nullable(),
  waitEventType: z.string().nullable(),
});

export type ActiveQuery = z.infer<typeof activeQuerySchema>;

export const longRunningQuerySchema = activeQuerySchema.extend({
  durationMs: z.number(),
});

export type LongRunningQuery = z.infer<typeof longRunningQuerySchema>;

export const lockInfoSchema = z.object({
  pid: z.number(),
  lockType: z.string(),
  mode: z.string(),
  granted: z.boolean(),
  relation: z.string().nullable(),
  query: z.string().nullable(),
});

export type LockInfo = z.infer<typeof lockInfoSchema>;

export const tableStatSchema = z.object({
  schema: z.string(),
  table: z.string(),
  liveTuples: z.number(),
  deadTuples: z.number(),
  lastVacuum: z.string().nullable(),
  lastAutovacuum: z.string().nullable(),
  lastAnalyze: z.string().nullable(),
});

export type TableStat = z.infer<typeof tableStatSchema>;

export const migrationTableStatusSchema = z.object({
  exists: z.boolean(),
  appliedCount: z.number().nullable(),
  latestMigration: z.string().nullable(),
});

export type MigrationTableStatus = z.infer<typeof migrationTableStatusSchema>;

export const releaseReadinessSchema = z.object({
  connected: z.boolean(),
  version: z.string().nullable(),
  databaseSize: z.number().nullable(),
  activeConnections: z.number(),
  longRunningQueries: z.array(longRunningQuerySchema),
  locks: z.array(lockInfoSchema),
  migrationTableExists: z.boolean(),
  riskLevel: riskLevelSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendation: z.string(),
});

export type ReleaseReadiness = z.infer<typeof releaseReadinessSchema>;

export const pingResultSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number(),
});

export type PingResult = z.infer<typeof pingResultSchema>;

import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const schemaStatsSchema = z.object({
  models: z.array(z.string()),
  enums: z.array(z.string()),
  datasources: z.array(z.string()),
  generators: z.array(z.string()),
});

export type SchemaStats = z.infer<typeof schemaStatsSchema>;

export const schemaValidationSchema = z.object({
  valid: z.boolean(),
  message: z.string(),
});

export type SchemaValidation = z.infer<typeof schemaValidationSchema>;

export const migrationInfoSchema = z.object({
  name: z.string(),
  folder: z.string(),
});

export type MigrationInfo = z.infer<typeof migrationInfoSchema>;

export const migrationStatusLocalSchema = z.object({
  migrationCount: z.number(),
  latestMigration: z.string().nullable(),
  migrations: z.array(migrationInfoSchema),
  lockProvider: z.string().nullable(),
});

export type MigrationStatusLocal = z.infer<typeof migrationStatusLocalSchema>;

export const migrateStatusSchema = z.object({
  upToDate: z.boolean(),
  pendingMigrations: z.array(z.string()),
  databaseReachable: z.boolean(),
  rawOutput: z.string(),
});

export type MigrateStatus = z.infer<typeof migrateStatusSchema>;

export const driftRiskSchema = z.object({
  level: riskLevelSchema,
  reasons: z.array(z.string()),
  pendingMigrations: z.boolean(),
  schemaInvalid: z.boolean(),
  formatDrift: z.boolean(),
});

export type DriftRisk = z.infer<typeof driftRiskSchema>;

export const releaseReadinessSchema = z.object({
  schemaValid: z.boolean(),
  schemaPath: z.string(),
  schemaHash: z.string(),
  migrationCount: z.number(),
  latestMigration: z.string().nullable(),
  pendingMigrations: z.array(z.string()),
  driftRisk: driftRiskSchema,
  riskLevel: riskLevelSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendation: z.string(),
});

export type ReleaseReadiness = z.infer<typeof releaseReadinessSchema>;

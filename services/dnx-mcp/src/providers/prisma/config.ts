import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { loadEnv } from "../../config/index.js";

export const prismaConfigSchema = z.object({
  schemaPath: z.string().min(1),
  migrationsPath: z.string().min(1),
  binary: z.string().min(1).default("prisma"),
  cwd: z.string().min(1),
});

export type PrismaConfig = z.infer<typeof prismaConfigSchema>;

export function resolvePrismaConfig(overrides: Partial<PrismaConfig> = {}): PrismaConfig {
  const env = loadEnv();
  const repoCwd =
    env.GIT_REPO_PATH && existsSync(env.GIT_REPO_PATH) ? resolve(env.GIT_REPO_PATH) : undefined;
  const cwd = overrides.cwd ?? repoCwd ?? process.cwd();

  const schemaPath = resolve(
    overrides.schemaPath ?? env.PRISMA_SCHEMA_PATH ?? resolve(cwd, "prisma/schema.prisma"),
  );

  const migrationsPath = resolve(
    overrides.migrationsPath ??
      env.PRISMA_MIGRATIONS_PATH ??
      resolve(dirname(schemaPath), "migrations"),
  );

  return prismaConfigSchema.parse({
    schemaPath,
    migrationsPath,
    binary: overrides.binary ?? env.PRISMA_BINARY ?? "prisma",
    cwd: overrides.cwd ?? cwd,
  });
}

export function isPrismaConfigured(config: Pick<PrismaConfig, "schemaPath">): boolean {
  return existsSync(config.schemaPath);
}

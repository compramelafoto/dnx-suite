import { describe, expect, it } from "vitest";
import type { ReleaseReadiness } from "../../providers/prisma/types/index.js";
import {
  assertPrismaAllowsReleaseExecution,
  prismaHasCriticalBlockers,
  PrismaReleaseBlockedError,
} from "./release-prisma.js";

const baseReadiness: ReleaseReadiness = {
  schemaValid: true,
  schemaPath: "/app/prisma/schema.prisma",
  schemaHash: "abc123def4567890",
  migrationCount: 5,
  latestMigration: "20240101000000_init",
  pendingMigrations: [],
  driftRisk: {
    level: "low",
    reasons: [],
    pendingMigrations: false,
    schemaInvalid: false,
    formatDrift: false,
  },
  riskLevel: "low",
  blockers: [],
  warnings: [],
  recommendation: "Estado Prisma listo para continuar con el pipeline de release",
};

describe("release-prisma", () => {
  it("detecta bloqueos críticos por schema inválido", () => {
    expect(prismaHasCriticalBlockers(baseReadiness)).toBe(false);
    expect(prismaHasCriticalBlockers({ ...baseReadiness, schemaValid: false })).toBe(true);
  });

  it("detecta bloqueos por migraciones pendientes", () => {
    expect(
      prismaHasCriticalBlockers({
        ...baseReadiness,
        pendingMigrations: ["20240101000000_init"],
        driftRisk: { ...baseReadiness.driftRisk, pendingMigrations: true },
      }),
    ).toBe(true);
  });

  it("detecta bloqueos por drift de formato", () => {
    expect(
      prismaHasCriticalBlockers({
        ...baseReadiness,
        driftRisk: { ...baseReadiness.driftRisk, formatDrift: true, level: "medium" },
      }),
    ).toBe(true);
  });

  it("assertPrismaAllowsReleaseExecution lanza con schema inválido", () => {
    expect(() => {
      assertPrismaAllowsReleaseExecution({ ...baseReadiness, schemaValid: false });
    }).toThrow(PrismaReleaseBlockedError);
  });
});

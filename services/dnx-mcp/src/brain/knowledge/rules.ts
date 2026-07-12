import type { BrainOperation, SignalSeverity } from "../types.js";

/** Umbrales de score para veredictos (0–100). */
export const SCORE_THRESHOLDS = {
  approve: 75,
  caution: 50,
} as const;

/** Score mínimo requerido por tipo de operación. */
export const OPERATION_MIN_SCORE: Record<BrainOperation, number> = {
  "release.prepare": 40,
  "release.validate": 60,
  "release.execute": 80,
  "release.rollback": 55,
};

/** Peso de penalización por severidad de riesgo. */
export const RISK_WEIGHTS: Record<SignalSeverity, number> = {
  low: 5,
  medium: 12,
  high: 25,
  critical: 40,
};

/** Penalización por inconsistencia detectada. */
export const INCONSISTENCY_PENALTY: Record<SignalSeverity, number> = {
  low: 5,
  medium: 10,
  high: 20,
  critical: 35,
};

/** Operaciones que nunca se aprueban con riesgos críticos bloqueantes. */
export const BLOCKING_OPERATIONS: BrainOperation[] = ["release.execute", "release.rollback"];

/** Reglas de conocimiento declarativas. */
export const KNOWLEDGE_RULES = [
  {
    id: "maintenance-blocks-execute",
    description: "Modo mantenimiento bloquea ejecución de release",
    when: { operation: "release.execute" as BrainOperation, signalKey: "maintenance.enabled" },
    effect: "reject" as const,
  },
  {
    id: "staging-required-before-execute",
    description: "Staging debe estar validado antes de ejecutar",
    when: { operation: "release.execute" as BrainOperation, signalKey: "staging.validated" },
    expectValue: true,
    effect: "reject" as const,
  },
  {
    id: "git-dirty-blocks-release",
    description: "Working tree sucio bloquea release",
    when: { signalKey: "git.dirtyTree" },
    effect: "reject" as const,
  },
  {
    id: "git-branch-not-allowed",
    description: "Rama no permitida bloquea release",
    when: { signalKey: "git.branch.allowed" },
    expectValue: true,
    effect: "reject" as const,
  },
  {
    id: "prisma-schema-invalid",
    description: "Schema Prisma inválido bloquea release",
    when: { signalKey: "prisma.schemaValid" },
    expectValue: true,
    effect: "reject" as const,
  },
  {
    id: "prisma-pending-migrations",
    description: "Migraciones Prisma pendientes bloquean release",
    when: { signalKey: "prisma.hasPendingMigrations" },
    expectValue: false,
    effect: "reject" as const,
  },
  {
    id: "prisma-format-drift",
    description: "Drift de formato en schema Prisma bloquea release",
    when: { signalKey: "prisma.formatDrift" },
    expectValue: false,
    effect: "reject" as const,
  },
  {
    id: "postgres-not-connected",
    description: "PostgreSQL no conectado bloquea release",
    when: { signalKey: "postgres.connected" },
    expectValue: true,
    effect: "reject" as const,
  },
  {
    id: "postgres-migration-table-missing",
    description: "Tabla _prisma_migrations ausente bloquea release",
    when: { signalKey: "postgres.migrationTableExists" },
    expectValue: true,
    effect: "reject" as const,
  },
  {
    id: "dry-run-always-caution",
    description: "Operaciones en dryRun reciben máximo caution",
    when: { dryRun: true },
    effect: "caution" as const,
  },
] as const;

/** Patrones de riesgo conocidos. */
export const RISK_PATTERNS = [
  {
    id: "unverified-domains",
    match: /dominio.*sin verificar|unverified/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "env-mismatch",
    match: /variable.*difiere|env.*mismatch|value_mismatch/i,
    defaultSeverity: "medium" as SignalSeverity,
    blocking: false,
  },
  {
    id: "no-preview-deployment",
    match: /no hay deployment de preview|preview.*no disponible/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "health-failed",
    match: /salud fallida|health.*failed|unhealthy/i,
    defaultSeverity: "critical" as SignalSeverity,
    blocking: true,
  },
  {
    id: "build-errors",
    match: /build.*error|errores detectados en logs/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "git-dirty-tree",
    match: /working tree sucio|cambios sin commitear|dirty tree/i,
    defaultSeverity: "critical" as SignalSeverity,
    blocking: true,
  },
  {
    id: "git-unpushed-commits",
    match: /sin push|unpushed|commits locales sin push/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "git-wrong-branch",
    match: /rama.*no permitida|no permitida para release/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "prisma-schema-invalid",
    match: /schema prisma inválido|schema inválido|prisma validate/i,
    defaultSeverity: "critical" as SignalSeverity,
    blocking: true,
  },
  {
    id: "prisma-pending-migrations",
    match: /migración.*pendiente|pending migration|migraciones pendientes/i,
    defaultSeverity: "critical" as SignalSeverity,
    blocking: true,
  },
  {
    id: "prisma-format-drift",
    match: /format --check|drift de formato|formato de schema/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "postgres-not-connected",
    match: /postgresql no conectado|no se pudo evaluar la base/i,
    defaultSeverity: "critical" as SignalSeverity,
    blocking: true,
  },
  {
    id: "postgres-long-running-queries",
    match: /query.*larga duración|long.?running/i,
    defaultSeverity: "critical" as SignalSeverity,
    blocking: true,
  },
  {
    id: "postgres-blocking-locks",
    match: /lock.*bloqueante|lock.*en espera|granted.*false/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
  {
    id: "postgres-high-connections",
    match: /conexión.*activa|active connection|muchas conexiones/i,
    defaultSeverity: "medium" as SignalSeverity,
    blocking: false,
  },
  {
    id: "postgres-migration-table-missing",
    match: /_prisma_migrations.*no encontrada|migration table/i,
    defaultSeverity: "high" as SignalSeverity,
    blocking: true,
  },
] as const;

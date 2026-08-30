import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { buildLeaseWindow, resolveLeaseMs } from "@/lib/cron-lease-policy";

/**
 * Locks de ejecución para crons, basados en un lease con vencimiento (tabla `CronLease`).
 *
 * Antes se usaba `pg_try_advisory_lock`, que es un lock **de sesión**. Como la app se conecta
 * por el pooler en modo transacción, el `pg_advisory_unlock` del final salía por otra conexión
 * y no liberaba nada: cada corrida dejaba un lock huérfano y las siguientes respondían
 * "another_analysis_active" para siempre. Verificado en producción el 24/08/2026.
 *
 * Con lease: si el proceso muere sin liberar, vence solo y el cron se recupera.
 */

export const CRON_LOCK_IDS = {
  CAMERA_INGEST: "CAMERA_INGEST",
  ANALYSIS: "ANALYSIS",
  EXIF_DEVICE_SCAN: "EXIF_DEVICE_SCAN",
} as const;

export type CronLockId = (typeof CRON_LOCK_IDS)[keyof typeof CRON_LOCK_IDS];

/** Token del lease, para que solo quien lo tomó pueda liberarlo. */
export type CronLockToken = string;

/**
 * Intenta tomar el lock. Devuelve el token si lo consiguió, o `null` si otra corrida lo tiene.
 * El valor es truthy/falsy, así que `if (!lock)` sigue funcionando como con el booleano viejo.
 */
export async function tryAcquireCronLock(
  lockId: CronLockId,
  leaseMs?: number
): Promise<CronLockToken | null> {
  const now = new Date();
  const holder = randomUUID();
  const { lockedAt, expiresAt } = buildLeaseWindow(now, resolveLeaseMs(leaseMs));

  // INSERT ... ON CONFLICT: crea la fila la primera vez y, si ya existe, solo la pisa
  // cuando el lease anterior venció. Atómico en una sola sentencia.
  const rows = await prisma.$executeRaw`
    INSERT INTO "CronLease" ("id", "holder", "lockedAt", "expiresAt", "updatedAt")
    VALUES (${lockId}, ${holder}, ${lockedAt}, ${expiresAt}, ${now})
    ON CONFLICT ("id") DO UPDATE
    SET "holder" = EXCLUDED."holder",
        "lockedAt" = EXCLUDED."lockedAt",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
    WHERE "CronLease"."expiresAt" IS NULL
       OR "CronLease"."expiresAt" <= ${now}
       OR "CronLease"."holder" IS NULL
  `;

  return Number(rows) === 1 ? holder : null;
}

/** Libera el lock solo si el token sigue siendo el dueño (no pisa el lease de otra corrida). */
export async function releaseCronLock(
  lockId: CronLockId,
  token: CronLockToken | null
): Promise<void> {
  if (!token) return;
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE "CronLease"
    SET "holder" = NULL,
        "lockedAt" = NULL,
        "expiresAt" = NULL,
        "updatedAt" = ${now}
    WHERE "id" = ${lockId}
      AND "holder" = ${token}
  `;
}

/** Estado del lease, para diagnóstico desde el panel o un script. */
export async function getCronLockState(lockId: CronLockId) {
  const row = await prisma.cronLease.findUnique({ where: { id: lockId } });
  const now = new Date();
  return {
    lockId,
    holder: row?.holder ?? null,
    lockedAt: row?.lockedAt ?? null,
    expiresAt: row?.expiresAt ?? null,
    isHeld: Boolean(row?.holder && row?.expiresAt && row.expiresAt.getTime() > now.getTime()),
  };
}

/** Libera a la fuerza (recuperación manual ante un lease colgado). */
export async function forceReleaseCronLock(lockId: CronLockId): Promise<void> {
  await prisma.cronLease.upsert({
    where: { id: lockId },
    create: { id: lockId },
    update: { holder: null, lockedAt: null, expiresAt: null },
  });
}

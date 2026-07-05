import { prisma } from "@/lib/prisma";

/** Namespace fijo para pg_advisory_lock(key1, key2) — evita colisiones con otras apps. */
const LOCK_NAMESPACE = 847_291;

export const CRON_LOCK_IDS = {
  CAMERA_INGEST: 1,
  ANALYSIS: 2,
  EXIF_DEVICE_SCAN: 3,
} as const;

export type CronLockId = (typeof CRON_LOCK_IDS)[keyof typeof CRON_LOCK_IDS];

export async function tryAcquireCronLock(lockId: CronLockId): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_lock(
      cast(${LOCK_NAMESPACE} as integer),
      cast(${lockId} as integer)
    ) AS acquired
  `;
  return rows[0]?.acquired === true;
}

export async function releaseCronLock(lockId: CronLockId): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(
      cast(${LOCK_NAMESPACE} as integer),
      cast(${lockId} as integer)
    )
  `;
}

/**
 * Política de leases para los crons.
 *
 * Reemplaza a `pg_try_advisory_lock`, que es un lock **de sesión**: con el pooler en modo
 * transacción (Neon/PgBouncer) el `pg_advisory_unlock` sale por otra conexión y no libera
 * nada, así que cada corrida dejaba un lock huérfano y el cron se bloqueaba a sí mismo.
 *
 * Un lease vive en una fila con vencimiento: si el proceso muere sin liberarlo, vence solo.
 */

export const CRON_LEASE_DEFAULT_MS = 15 * 60 * 1000;
export const CRON_LEASE_MAX_MS = 60 * 60 * 1000;

export type LeaseRow = {
  holder: string | null;
  expiresAt: Date | null;
};

export function resolveLeaseMs(leaseMs: number | undefined): number {
  if (leaseMs == null || !Number.isFinite(leaseMs) || leaseMs <= 0) {
    return CRON_LEASE_DEFAULT_MS;
  }
  return Math.min(CRON_LEASE_MAX_MS, Math.floor(leaseMs));
}

export function buildLeaseWindow(now: Date, leaseMs: number) {
  return {
    lockedAt: new Date(now.getTime()),
    expiresAt: new Date(now.getTime() + resolveLeaseMs(leaseMs)),
  };
}

/** ¿Hay alguien corriendo ahora mismo? Un lease vencido cuenta como libre. */
export function isLeaseHeld(row: LeaseRow | null | undefined, now: Date): boolean {
  if (!row?.holder || !row.expiresAt) return false;
  return row.expiresAt.getTime() > now.getTime();
}

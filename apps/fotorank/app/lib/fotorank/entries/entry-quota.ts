/**
 * Cupo de obras por inscripción.
 *
 * Sustituye la garantía que antes daba el índice único de la base
 * (`FotorankContestEntry.registrationId @unique`, una obra por inscripción).
 * Ahora el límite es configurable por concurso, y esta es la única puerta que
 * decide si se puede crear una obra más.
 *
 * COMPATIBILIDAD: el default es 1. Un concurso que no configure nada se
 * comporta exactamente como antes del cambio.
 *
 * El cupo efectivo es el MENOR entre lo que permite el concurso y lo que
 * habilitó el pago: si la política admite 3 pero el participante compró 2,
 * puede subir 2.
 */

/** Default histórico: una obra por inscripción. */
export const DEFAULT_MAX_ENTRIES_PER_REGISTRATION = 1;

/** Tope defensivo: ninguna configuración puede habilitar más que esto. */
export const ABSOLUTE_MAX_ENTRIES_PER_REGISTRATION = 20;

export type EntryQuotaInput = {
  /** `maxEntriesPerRegistration` de la política del concurso. */
  policyMaxEntries?: number | null;
  /** Obras habilitadas por el paquete pagado. null = el pago no define cupo. */
  purchasedEntriesCount?: number | null;
  /** Obras que ya existen en la inscripción y ocupan cupo. */
  currentEntryCount: number;
};

export type EntryQuota = {
  /** Cupo efectivo. */
  limit: number;
  used: number;
  remaining: number;
  canCreateMore: boolean;
};

function normalizeLimit(value: number | null | undefined, fallback: number): number {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, ABSOLUTE_MAX_ENTRIES_PER_REGISTRATION);
}

export function resolveEntryQuota(input: EntryQuotaInput): EntryQuota {
  const policyLimit = normalizeLimit(
    input.policyMaxEntries,
    DEFAULT_MAX_ENTRIES_PER_REGISTRATION,
  );

  // El pago sólo puede RESTRINGIR, nunca ampliar lo que el concurso permite.
  const purchased =
    input.purchasedEntriesCount == null
      ? null
      : normalizeLimit(input.purchasedEntriesCount, policyLimit);

  const limit = purchased == null ? policyLimit : Math.min(policyLimit, purchased);
  const used = Math.max(0, input.currentEntryCount);
  const remaining = Math.max(0, limit - used);

  return { limit, used, remaining, canCreateMore: remaining > 0 };
}

export type EntryQuotaCheck =
  | { allowed: true; remainingAfter: number }
  | { allowed: false; reason: "QUOTA_EXCEEDED"; message: string; quota: EntryQuota };

/**
 * Puerta de creación de obras. Se consulta ANTES de persistir una obra nueva.
 * Falla cerrado: ante una configuración inválida se cae al default de 1.
 */
export function canCreateEntry(input: EntryQuotaInput): EntryQuotaCheck {
  const quota = resolveEntryQuota(input);
  if (!quota.canCreateMore) {
    return {
      allowed: false,
      reason: "QUOTA_EXCEEDED",
      message:
        quota.limit === 1
          ? "Ya cargaste tu fotografía para este concurso."
          : `Alcanzaste el máximo de ${quota.limit} fotografías para tu inscripción.`,
      quota,
    };
  }
  return { allowed: true, remainingAfter: quota.remaining - 1 };
}

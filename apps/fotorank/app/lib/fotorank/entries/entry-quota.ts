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

import { allowsMultipleCategories } from "./upload-policy";

/** Default histórico: una obra por inscripción. */
export const DEFAULT_MAX_ENTRIES_PER_REGISTRATION = 1;

/** Tope defensivo: ninguna configuración puede habilitar más que esto. */
export const ABSOLUTE_MAX_ENTRIES_PER_REGISTRATION = 20;

function isValidLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * De dónde sale el límite del concurso.
 *
 * 1. `maxEntriesPerRegistration` de la política, si el concurso la tiene: es lo
 *    que fijó la configuración de bases y manda sobre todo lo demás.
 * 2. Si no, el "Máx. archivos" de la categoría. Es el único campo que el
 *    organizador puede editar desde el panel; antes se mostraba al participante
 *    pero no limitaba nada, y la carga caía al default de 1 (Retratos del mundo
 *    2026 tenía 3 por categoría y sólo dejaba subir una).
 * 3. Si tampoco hay categoría válida, el default histórico.
 *
 * Una política presente pero inválida NO cede a la categoría: falla cerrado.
 */
export function resolvePolicyMaxEntries(
  uploadPolicyJson: unknown,
  categoryMaxFiles?: number | null,
): number {
  if (uploadPolicyJson && typeof uploadPolicyJson === "object" && "maxEntriesPerRegistration" in uploadPolicyJson) {
    const v = (uploadPolicyJson as { maxEntriesPerRegistration?: unknown }).maxEntriesPerRegistration;
    return isValidLimit(v) ? v : DEFAULT_MAX_ENTRIES_PER_REGISTRATION;
  }
  return isValidLimit(categoryMaxFiles) ? categoryMaxFiles : DEFAULT_MAX_ENTRIES_PER_REGISTRATION;
}

/**
 * Borrador vacío: la obra que se crea al pedir la carga y queda así si el
 * archivo nunca llega (red caída, foto ilegible en iPhone). No es una obra del
 * participante: se reusa en el próximo intento en lugar de crear otra.
 */
export function isEmptyDraftEntry(entry: { status: string; hasOriginal: boolean }): boolean {
  return entry.status === "DRAFT" && !entry.hasOriginal;
}

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

/**
 * Cuántas obras puede subir una inscripción, para mostrárselo al participante.
 * Es la misma cuenta que hace la puerta de creación: si la pantalla dijera 3 y
 * la puerta dejara 1, vuelve el problema de Retratos del mundo 2026.
 */
export function resolveRegistrationEntryLimit(input: {
  uploadPolicyJson: unknown;
  categoryMaxFiles?: number | null;
  purchasedEntriesCount?: number | null;
}): number {
  return resolveEntryQuota({
    policyMaxEntries: resolvePolicyMaxEntries(input.uploadPolicyJson, input.categoryMaxFiles),
    purchasedEntriesCount: input.purchasedEntriesCount,
    currentEntryCount: 0,
  }).limit;
}

export type CategoryEntryLimit = { categoryId: string; name: string; slug: string; limit: number };

/**
 * En qué categorías puede presentar obras una inscripción y cuántas en cada
 * una. Sin el interruptor de varias categorías es sólo la de la inscripción;
 * con él, todas las del concurso, primero la de la inscripción.
 */
export function resolveCategoryEntryLimits(input: {
  uploadPolicyJson: unknown;
  registrationCategoryId: string;
  categories: Array<{ id: string; name: string; slug: string; maxFiles: number }>;
  purchasedEntriesCount?: number | null;
}): CategoryEntryLimit[] {
  const own = input.categories.filter((c) => c.id === input.registrationCategoryId);
  const others = allowsMultipleCategories(input.uploadPolicyJson)
    ? input.categories.filter((c) => c.id !== input.registrationCategoryId)
    : [];
  return [...own, ...others].map((c) => ({
    categoryId: c.id,
    name: c.name,
    slug: c.slug,
    limit: resolveRegistrationEntryLimit({
      uploadPolicyJson: input.uploadPolicyJson,
      categoryMaxFiles: c.maxFiles,
      purchasedEntriesCount: input.purchasedEntriesCount,
    }),
  }));
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

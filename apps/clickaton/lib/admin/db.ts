import { Prisma, prisma } from "@repo/db";
import { PartnersDomainError } from "@repo/partners";

export type ClickatonDbUnavailableReason = "migration_pending" | "db_error";

export type ClickatonDbResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ClickatonDbUnavailableReason; message: string };

function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return "message" in error && typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message
    : "";
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  // Solo tablas/columnas ausentes — no matchear nombres de modelo en errores genéricos de Prisma.
  if (code === "P2021" || code === "P2022") return true;
  const message = errorMessage(error);
  return /(?:table|relation|column).*(?:does not exist|don't exist)|does not exist in the current database/i.test(
    message,
  );
}

/** Enum / schema desfasado (p. ej. LOGO_GENERAL aún no migrado en Production). */
function isSchemaMismatchError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = errorMessage(error);
  if (code === "P2010" || code === "22P02") return true;
  return /invalid input value for enum|enum.*does not exist|Value .* not found in enum/i.test(
    message,
  );
}

function missingTableHint(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const meta =
    "meta" in error && error.meta && typeof error.meta === "object"
      ? (error.meta as { table?: unknown; column?: unknown; modelName?: unknown })
      : null;
  const fromMeta = typeof meta?.table === "string" ? meta.table : null;
  const fromMsg = message.match(/table [`']?([A-Za-z0-9_."]+)[`']?/i)?.[1] ?? null;
  return fromMeta || fromMsg;
}

export async function withClickatonDb<T>(
  operation: () => Promise<T>,
  fallbackMessage = "No se pudo acceder a la base de datos.",
): Promise<ClickatonDbResult<T>> {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (error) {
    // Errores de dominio de partners: propagar para flash/redirect en server actions.
    if (error instanceof PartnersDomainError) {
      throw error;
    }
    if (isMissingTableError(error)) {
      const table = missingTableHint(error);
      return {
        ok: false,
        reason: "migration_pending",
        message: table
          ? `Falta la tabla ${table} en la base de Production. Hay que aplicar la migración Prisma correspondiente (prisma migrate deploy).`
          : "Falta una tabla/columna en la base de Production. Aplicá las migraciones Prisma pendientes.",
      };
    }
    if (isSchemaMismatchError(error)) {
      return {
        ok: false,
        reason: "migration_pending",
        message:
          "La base de Production no tiene el esquema de logos actualizado (falta LOGO_GENERAL u otro enum). Hay que aplicar las migraciones Prisma pendientes (prisma migrate deploy).",
      };
    }
    console.error("[clickaton] database error:", error);
    const detail = errorMessage(error).slice(0, 220);
    return {
      ok: false,
      reason: "db_error",
      message: detail
        ? `${fallbackMessage} (${detail})`
        : fallbackMessage,
    };
  }
}

export { Prisma, prisma };

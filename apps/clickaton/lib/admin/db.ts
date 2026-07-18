import { prisma } from "@repo/db";

export type ClickatonDbUnavailableReason = "migration_pending" | "db_error";

export type ClickatonDbResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ClickatonDbUnavailableReason; message: string };

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2021" || code === "P2022") return true;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return /does not exist|relation .* does not exist|ClickatonEdition/i.test(message);
}

export async function withClickatonDb<T>(
  operation: () => Promise<T>,
  fallbackMessage = "No se pudo acceder a la base de datos.",
): Promise<ClickatonDbResult<T>> {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false,
        reason: "migration_pending",
        message:
          "Las tablas de ediciones y sedes aún no existen. Aplicá la migración 20260718120000_clickaton_editions_and_venues cuando corresponda.",
      };
    }
    console.error("[clickaton] database error:", error);
    return {
      ok: false,
      reason: "db_error",
      message: fallbackMessage,
    };
  }
}

export { prisma };

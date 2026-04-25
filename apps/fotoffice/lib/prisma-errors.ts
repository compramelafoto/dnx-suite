/**
 * Errores de Prisma cuando el servidor de base de datos no está alcanzable
 * (Neon pausado, red, URL incorrecta, etc.).
 */
export function isPrismaDbUnavailableError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : "";
  if (code === "P1001" || code === "P1002" || code === "P1017") return true;
  const name = typeof e.name === "string" ? e.name : "";
  if (name === "PrismaClientInitializationError") return true;
  return false;
}

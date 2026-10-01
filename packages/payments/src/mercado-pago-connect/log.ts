/**
 * Registro de fallas del flujo de conexión, sin filtrar secretos.
 *
 * El detalle del error hace falta para diagnosticar —sin él, un fallo del proveedor es
 * indistinguible de un bug propio—, pero el mensaje puede arrastrar el código de
 * autorización o parte de un token. Se recorta y se enmascara lo que parezca un secreto.
 */
const SECRETO = /(APP_USR-[\w-]+|TEST-[\w-]+|TG-[\w-]+|[A-Za-z0-9_-]{40,})/g;

export function sanitizeError(error: unknown): string {
  const raw =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "desconocido");
  return raw.replace(SECRETO, "***").slice(0, 400);
}

/**
 * Los tokens de Mercado Pago (acceso y refresco) son la llave para cobrar, devolver y leer
 * la cuenta del vendedor: nunca viajan al navegador. A la pantalla le alcanza saber si la
 * cuenta está conectada.
 *
 * `mpConnected` sólo se agrega si el registro trajo `mpAccessToken` (aunque sea `null`):
 * si la consulta no lo pidió, no se puede afirmar ni negar la conexión.
 */
export function withoutMpTokens<T extends Record<string, unknown>>(
  record: T,
): Omit<T, "mpAccessToken" | "mpRefreshToken"> & { mpConnected?: boolean } {
  const { mpAccessToken, mpRefreshToken: _refresh, ...rest } = record;
  if (!("mpAccessToken" in record)) return rest;
  return { ...rest, mpConnected: Boolean(mpAccessToken) };
}

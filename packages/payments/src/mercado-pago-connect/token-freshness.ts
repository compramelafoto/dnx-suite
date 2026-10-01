/**
 * Decidir qué hacer con el token guardado, sin tocar la red ni la base.
 *
 * Se separa para poder probar los bordes que en la práctica aparecen una vez cada seis meses
 * y siempre en el peor momento: el token que vence en dos minutos, el que ya venció sin
 * refresh token, el que no declara vencimiento.
 */

export type TokenDecision = "USE" | "REFRESH" | "CANNOT_REFRESH";

/**
 * Margen de seguridad. Un token que vence dentro de un minuto sirve para nada: entre que se
 * arma la preferencia y MercadoPago la procesa, ya venció.
 */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;

export function decideTokenUse(input: {
  expiresAt: Date | null;
  hasRefreshToken: boolean;
  now: Date;
}): TokenDecision {
  // Sin vencimiento declarado se usa tal cual: inventar uno haría refrescar tokens sanos, y
  // cada refresco rota el refresh token, así que fallar ahí es peor que no refrescar.
  if (!input.expiresAt) return "USE";

  const vencePronto = input.expiresAt.getTime() - input.now.getTime() <= REFRESH_SKEW_MS;
  if (!vencePronto) return "USE";
  return input.hasRefreshToken ? "REFRESH" : "CANNOT_REFRESH";
}

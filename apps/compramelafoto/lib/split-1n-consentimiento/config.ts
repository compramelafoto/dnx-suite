import { CONSENTIMIENTO_FLAG } from "../split-1n-piloto/config";

/**
 * Consentimiento de Split 1:N desde el panel: el fotógrafo (u organizador, o referidor) pide
 * la invitación de Mercado Pago y CLF guarda su `receiver_id`. Apagado por defecto.
 *
 * Para que la invitación salga de verdad también hace falta
 * `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED=true` (el freno del adaptador de pagos) y el token
 * de la plataforma del piloto.
 */
export function resolveConsentimientoConfig(env: NodeJS.ProcessEnv = process.env): { enabled: boolean } {
  return { enabled: env[CONSENTIMIENTO_FLAG]?.trim().toLowerCase() === "true" };
}

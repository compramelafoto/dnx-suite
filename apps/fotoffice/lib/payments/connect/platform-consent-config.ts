import {
  createMercadoPagoProviderConfig,
  isSplitConsentProductionEnabled,
  SPLIT_CONSENT_PRODUCTION_FLAG,
  type MercadoPagoProviderConfig,
} from "@repo/payments/mercado-pago";

export { SPLIT_CONSENT_PRODUCTION_FLAG };

/**
 * Configuración de MercadoPago para pedir el consentimiento de cobro dividido con el
 * token de la plataforma.
 *
 * El consentimiento tiene **dos frenos distintos** y hay que pasar los dos:
 *
 * 1. `assertSplitConsentWriteAllowed`, en el adaptador del paquete, que depende de
 *    `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`.
 * 2. `allowProductionWrites`, en esta configuración, que es el que mira el cliente HTTP
 *    antes de cualquier POST/PATCH con `environment: "production"`.
 *
 * Por eso el campo se agrega **sólo** cuando la bandera está encendida: con la bandera
 * apagada la configuración sigue fallando cerrada y la invitación no sale, igual que antes.
 * Encender la bandera en el entorno alcanza para que la pantalla funcione, sin desplegar.
 */
export function buildPlatformConsentConfig(
  accessToken: string,
  env: NodeJS.ProcessEnv = process.env,
): MercadoPagoProviderConfig {
  const escribeEnProduccion = isSplitConsentProductionEnabled(env);
  return createMercadoPagoProviderConfig({
    accessToken,
    environment: "production",
    ...(escribeEnProduccion ? { allowProductionWrites: true } : {}),
  });
}

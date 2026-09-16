import type { MpConnectConfig } from "@repo/payments/mercado-pago-connect";
import { SUBILAFOTO_MP_ENV } from "./constantes";

export type { MpConnectConfig };

/**
 * Lee la configuración de la aplicación de MercadoPago.
 *
 * **Es la aplicación única de la suite**, no una de SubiLaFoto: `SUBILAFOTO_MP_CLIENT_ID`
 * y `SUBILAFOTO_MP_CLIENT_SECRET` llevan los valores de la app "DNX Suite". Lo único
 * propio del producto es la URL de retorno, que sí se puede declarar una por producto en
 * el panel de MercadoPago —a diferencia de la de notificación, que es una sola para todo—.
 *
 * `redirectUri` se guarda como variable y no se arma concatenando el dominio: tiene que
 * coincidir **byte a byte** con la del panel, y una barra final de más hace fallar el
 * intercambio del código con un error opaco.
 */
export function leerConfigDePagos(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MpConnectConfig {
  const leer = (clave: string): string | null => env[clave]?.trim() || null;

  const clientId = leer(SUBILAFOTO_MP_ENV.clientId);
  const clientSecret = leer(SUBILAFOTO_MP_ENV.clientSecret);
  const redirectUri = leer(SUBILAFOTO_MP_ENV.redirectUri);

  const missing: string[] = [];
  if (!clientId) missing.push(SUBILAFOTO_MP_ENV.clientId);
  if (!clientSecret) missing.push(SUBILAFOTO_MP_ENV.clientSecret);
  if (!redirectUri) missing.push(SUBILAFOTO_MP_ENV.redirectUri);

  return { configured: missing.length === 0, missing, clientId, clientSecret, redirectUri };
}

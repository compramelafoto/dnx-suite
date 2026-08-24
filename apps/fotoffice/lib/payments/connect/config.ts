import { FOTOFFICE_MP_ENV } from "./constants";

export type MpConnectConfig = {
  configured: boolean;
  /** Nombres de las variables que faltan, para poder decírselo al operador. */
  missing: string[];
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
};

/**
 * Lee la configuración de la aplicación de MercadoPago de FotoOffice.
 *
 * `redirectUri` tiene que coincidir **byte a byte** con la cargada en el panel de
 * MercadoPago: una barra final de más y el intercambio del código falla con un error
 * opaco que cuesta horas diagnosticar. Por eso se guarda como variable y no se arma
 * concatenando el dominio en tiempo de ejecución.
 */
export function readMpConnectConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MpConnectConfig {
  const read = (key: string): string | null => env[key]?.trim() || null;

  const clientId = read(FOTOFFICE_MP_ENV.clientId);
  const clientSecret = read(FOTOFFICE_MP_ENV.clientSecret);
  const redirectUri = read(FOTOFFICE_MP_ENV.redirectUri);

  const missing: string[] = [];
  if (!clientId) missing.push(FOTOFFICE_MP_ENV.clientId);
  if (!clientSecret) missing.push(FOTOFFICE_MP_ENV.clientSecret);
  if (!redirectUri) missing.push(FOTOFFICE_MP_ENV.redirectUri);

  return { configured: missing.length === 0, missing, clientId, clientSecret, redirectUri };
}

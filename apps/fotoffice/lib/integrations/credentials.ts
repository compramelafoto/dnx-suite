/**
 * Qué cliente OAuth de Google usan las integraciones. Módulo PURO.
 *
 * ── Por qué uno propio y no el del login ──
 *
 * El cliente del login lo comparten todas las aplicaciones de la suite: el mismo id atiende
 * a CompraMeLaFoto y a FotoOffice. Ese cliente pide solo permisos básicos, que Google deja
 * pasar sin verificar.
 *
 * Las integraciones piden permisos **sensibles** —el calendario de la institución—, y para
 * eso Google exige verificar la app. Pedirlos con el cliente compartido metería el login de
 * CompraMeLaFoto en ese trámite: si Google observa algo, lo que se cae no es el calendario
 * de la SFPR sino el ingreso de una aplicación que hoy funciona.
 *
 * Con un cliente propio, lo que pase con los permisos de Calendar no puede tocar el login.
 *
 * Mientras no exista el cliente propio se usa el compartido, para que nada deje de andar.
 */

export const INTEGRATIONS_GOOGLE_CLIENT_ID_ENV = "DNX_INTEGRATIONS_GOOGLE_CLIENT_ID";
export const INTEGRATIONS_GOOGLE_CLIENT_SECRET_ENV = "DNX_INTEGRATIONS_GOOGLE_CLIENT_SECRET";

export type IntegrationsGoogleCredentials = {
  clientId: string;
  clientSecret: string;
  /** true si viene del cliente propio de integraciones; false si cayó al compartido. */
  dedicated: boolean;
};

function leer(env: NodeJS.ProcessEnv, clave: string): string | null {
  const v = env[clave]?.trim();
  return v && v.length > 0 ? v : null;
}

export function readIntegrationsGoogleCredentials(
  env: NodeJS.ProcessEnv = process.env,
): IntegrationsGoogleCredentials | null {
  const propioId = leer(env, INTEGRATIONS_GOOGLE_CLIENT_ID_ENV);
  const propioSecret = leer(env, INTEGRATIONS_GOOGLE_CLIENT_SECRET_ENV);

  // Las dos mitades o ninguna. Mezclar el id de un cliente con el secreto de otro produce
  // un error de Google que nadie puede diagnosticar mirando la pantalla.
  if (propioId && propioSecret) {
    return { clientId: propioId, clientSecret: propioSecret, dedicated: true };
  }

  const compartidoId = leer(env, "GOOGLE_CLIENT_ID");
  const compartidoSecret = leer(env, "GOOGLE_CLIENT_SECRET");
  if (compartidoId && compartidoSecret) {
    return { clientId: compartidoId, clientSecret: compartidoSecret, dedicated: false };
  }

  return null;
}

import "server-only";

/**
 * Conexión de la cuenta de Mercado Pago del vendedor.
 *
 * Portado de CompraMeLaFoto (`lib/mercadopago-oauth.ts`), que lleva más de un
 * año en producción. Se copia y no se importa porque las dos aplicaciones
 * tienen su propia aplicación registrada en Mercado Pago y su propia URL de
 * retorno; compartir el módulo obligaría a pasar todo por parámetro y no
 * ahorraría nada.
 *
 * El vendedor cobra en **su** cuenta. La plataforma se lleva su comisión con
 * `marketplace_fee` en el momento del cobro, sin que la plata pase por una
 * cuenta nuestra.
 */

const AUTORIZACION = "https://auth.mercadopago.com/authorization";
const TOKEN = "https://api.mercadopago.com/oauth/token";

export type RespuestaDeToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: string | number;
};

function requerir(clave: string): string {
  const valor = process.env[clave]?.trim();
  if (!valor) throw new Error(`Falta ${clave}.`);
  return valor;
}

export function urlDeAutorizacion(estado: string): string {
  const url = new URL(AUTORIZACION);
  url.searchParams.set("client_id", requerir("MP_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", requerir("MP_REDIRECT_URI"));
  // Viaja de ida y vuelta: es lo que impide que alguien dispare el retorno.
  url.searchParams.set("state", estado);
  return url.toString();
}

export async function canjearCodigo(codigo: string): Promise<RespuestaDeToken> {
  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: requerir("MP_CLIENT_ID"),
      client_secret: requerir("MP_CLIENT_SECRET"),
      code: codigo,
      redirect_uri: requerir("MP_REDIRECT_URI"),
    }),
  });

  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaDeToken & {
    error?: string;
    message?: string;
  };

  if (!respuesta.ok || !datos.access_token) {
    throw new Error(datos.message || datos.error || "Mercado Pago rechazó la conexión.");
  }
  return datos;
}

export async function renovarToken(refreshToken: string): Promise<RespuestaDeToken> {
  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: requerir("MP_CLIENT_ID"),
      client_secret: requerir("MP_CLIENT_SECRET"),
      refresh_token: refreshToken,
    }),
  });

  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaDeToken & {
    error?: string;
    message?: string;
  };

  if (!respuesta.ok || !datos.access_token) {
    throw new Error(datos.message || datos.error || "No se pudo renovar el token.");
  }
  return datos;
}

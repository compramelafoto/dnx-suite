/**
 * Con qué credenciales se habla con el proveedor de video.
 *
 * El video de un curso grabado vive en Cloudflare Stream, la misma cuenta de Cloudflare que
 * ya guarda las fotos en R2. Hacen falta cuatro cosas: la cuenta, un token para crear videos
 * y pedir URLs de subida, y un par de claves para **firmar el permiso de reproducción** de
 * cada alumno — sin esa firma el video no se ve en ningún lado, que es justamente el punto.
 *
 * Nunca lanza. Si falta una variable, la pantalla dice cuál y el curso presencial sigue
 * funcionando como si nada; mismo criterio que `lib/payments/connect/config.ts`.
 */

export type StreamConfig = {
  accountId: string;
  apiToken: string;
  signingKeyId: string;
  signingKeyPem: string;
};

export const STREAM_ENV = [
  "STREAM_ACCOUNT_ID",
  "STREAM_API_TOKEN",
  "STREAM_SIGNING_KEY_ID",
  "STREAM_SIGNING_KEY_PEM",
] as const;

export type StreamConfigResult =
  | { ok: true; config: StreamConfig }
  | { ok: false; missing: string[] };

export function readStreamConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StreamConfigResult {
  const missing = STREAM_ENV.filter((nombre) => !env[nombre]?.trim());
  if (missing.length > 0) return { ok: false, missing: [...missing] };

  return {
    ok: true,
    config: {
      accountId: env.STREAM_ACCOUNT_ID!.trim(),
      apiToken: env.STREAM_API_TOKEN!.trim(),
      signingKeyId: env.STREAM_SIGNING_KEY_ID!.trim(),
      signingKeyPem: env.STREAM_SIGNING_KEY_PEM!.trim(),
    },
  };
}

/** Para la pantalla: "falta cargar X e Y". En español y sin nombres de variables sueltos. */
export function explicarConfiguracionFaltante(missing: string[]): string {
  return `La carga de video no está configurada: falta ${missing.join(", ")}.`;
}

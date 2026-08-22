/**
 * Configuración de envío de FotoOffice, resuelta desde el entorno.
 *
 * Regla central: NO hay remitente por defecto. La versión anterior caía en
 * `Fotoffice <no-reply@fotoffice.app>`, un dominio que no está verificado en Resend, así que
 * el proveedor lo rechazaba y el envío moría sin que nadie se enterara. Preferimos un fallo
 * explícito y diagnosticable antes que sustituir el dominio en silencio.
 */

export const RESEND_API_KEY_VAR = "RESEND_API_KEY";
export const NOTIFICATIONS_FROM_VAR = "FOTOFFICE_NOTIFICATIONS_FROM";

export type EmailConfig = {
  apiKey: string;
  /** Remitente tal cual se configuró: puede venir como `Nombre <casilla@dominio>` o pelado. */
  from: string;
};

export type EmailConfigResult =
  | { ok: true; config: EmailConfig }
  /** `missing` lista NOMBRES de variables, nunca valores: se registra en logs. */
  | { ok: false; missing: string[] };

type EnvLike = Record<string, string | undefined>;

function read(env: EnvLike, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

export function resolveEmailConfig(env: EnvLike = process.env): EmailConfigResult {
  const apiKey = read(env, RESEND_API_KEY_VAR);
  const from = read(env, NOTIFICATIONS_FROM_VAR);

  const missing: string[] = [];
  if (!apiKey) missing.push(RESEND_API_KEY_VAR);
  if (!from) missing.push(NOTIFICATIONS_FROM_VAR);
  if (!apiKey || !from) return { ok: false, missing };

  return { ok: true, config: { apiKey, from } };
}

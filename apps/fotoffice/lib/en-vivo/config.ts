import { readStreamConfig, type StreamConfig } from "@/lib/courses-video/config";
import { INTEGRATIONS_MASTER_KEY_ENV } from "@/lib/integrations/vault";

/**
 * Con qué credenciales se transmite en vivo.
 *
 * Reusa las de los cursos grabados (`lib/courses-video/config.ts`): la misma cuenta de
 * Cloudflare Stream, el mismo token y las mismas claves de firma de reproducción. Nada nuevo
 * para lo básico. Se suman dos cosas opcionales:
 *
 * - `STREAM_WEBHOOK_SECRET`: sin él los avisos de Cloudflare no se aceptan, pero el panel igual
 *   funciona porque le pregunta el estado a Cloudflare al refrescar.
 * - `DNX_INTEGRATIONS_VAULT_MASTER_KEY` (el baúl de integraciones, ya existe): sin él no se
 *   pueden *recordar* las claves de YouTube y TikTok; Instagram funciona igual.
 *
 * Nunca lanza: si falta algo, la pantalla dice «todavía no está habilitada», como Cobros.
 */

export const STREAM_WEBHOOK_SECRET_ENV = "STREAM_WEBHOOK_SECRET";

export type LiveConfig =
  | {
      ok: true;
      stream: StreamConfig;
      webhookSecret: string | null;
      puedeRecordarClaves: boolean;
    }
  | { ok: false; missing: string[] };

export function readLiveConfig(env: Readonly<Record<string, string | undefined>> = process.env): LiveConfig {
  const stream = readStreamConfig(env);
  if (!stream.ok) return { ok: false, missing: stream.missing };
  return {
    ok: true,
    stream: stream.config,
    webhookSecret: env[STREAM_WEBHOOK_SECRET_ENV]?.trim() || null,
    puedeRecordarClaves: Boolean(env[INTEGRATIONS_MASTER_KEY_ENV]?.trim()),
  };
}

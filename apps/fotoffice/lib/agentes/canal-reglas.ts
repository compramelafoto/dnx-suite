import { z } from "zod";

/**
 * El canal de Telegram de los agentes (spec 2026-11-07): un bot aparte del de presupuestos, cuyo
 * token vive en `TELEGRAM_AGENTES_BOT_TOKEN` (nunca en la base). En `SystemSettings` (clave
 * `fotoffice_agentes_telegram`) quedan el bot, el chat vinculado, el código de vínculo y el hash
 * del secreto del webhook. Módulo PURO: leer/escribir ese JSON y decidir el vínculo.
 */

export const CLAVE_CANAL_AGENTES = "fotoffice_agentes_telegram";
export const VARIABLE_TOKEN_AGENTES = "TELEGRAM_AGENTES_BOT_TOKEN";
export const MINUTOS_CODIGO_AGENTES = 30;

const esquemaCanal = z.object({
  botId: z.string().min(1),
  botUsername: z.string().min(1),
  chatId: z.string().nullable(),
  chatNombre: z.string().nullable(),
  webhookSecretHash: z.string().regex(/^[a-f0-9]{64}$/),
  linkCode: z.string().nullable(),
  /** ISO 8601. */
  linkCodeExpiresAt: z.string().nullable(),
  linkedAt: z.string().nullable(),
});

export type CanalAgentes = z.infer<typeof esquemaCanal>;

/** El JSON guardado → canal; cualquier cosa rara (o nada) es "sin canal". */
export function leerCanal(valor: string | null | undefined): CanalAgentes | null {
  if (!valor) return null;
  try {
    const r = esquemaCanal.safeParse(JSON.parse(valor));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function escribirCanal(canal: CanalAgentes): string {
  return JSON.stringify(esquemaCanal.parse(canal));
}

/** Enlace para vincular el chat: abre el bot con "Iniciar", que manda `/start <código>`. */
export function enlaceVinculoAgentes(botUsername: string, codigo: string): string {
  return `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(codigo)}`;
}

export function codigoVigente(canal: CanalAgentes, ahora: Date): string | null {
  if (!canal.linkCode || !canal.linkCodeExpiresAt) return null;
  const vence = Date.parse(canal.linkCodeExpiresAt);
  return Number.isFinite(vence) && vence > ahora.getTime() ? canal.linkCode : null;
}

export type DecisionVinculo = "VINCULAR" | "YA_VINCULADO" | "IGNORAR";

/**
 * `/start <código>`: sólo vincula un chat privado con el código vigente. El chat ya vinculado que
 * toca "Iniciar" de nuevo recibe "ya vinculado"; cualquier otro, silencio (no le contestamos a
 * desconocidos).
 */
export function decidirVinculo(
  canal: CanalAgentes,
  datos: { chatId: string; chatPrivado: boolean; codigo: string | null },
  ahora: Date,
): DecisionVinculo {
  const vigente = codigoVigente(canal, ahora);
  if (datos.chatPrivado && datos.codigo && vigente && datos.codigo === vigente) return "VINCULAR";
  if (canal.chatId && canal.chatId === datos.chatId) return "YA_VINCULADO";
  return "IGNORAR";
}

/** ¿Lo manda el chat vinculado? En un chat privado el chat es la persona: si viene `deId`, también tiene que coincidir. */
export function esDelChatVinculado(canal: CanalAgentes | null, chatId: string | null, deId?: string | null): boolean {
  if (!canal?.chatId || !chatId || chatId !== canal.chatId) return false;
  return deId === undefined || deId === null || deId === canal.chatId;
}

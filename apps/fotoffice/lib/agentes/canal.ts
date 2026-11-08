import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { cambiarBotones, contestarBoton, datosDelBot, mandarFoto, mandarMensaje, MAX_LEYENDA_FOTO, registrarWebhook, type DepsTelegramApi, type TecladoTelegram } from "@/lib/telegram/api";
import { codigoDeVinculo, hashDeSecreto, secretoNuevo } from "@/lib/telegram/webhook";
import {
  CLAVE_CANAL_AGENTES,
  codigoVigente,
  decidirVinculo,
  enlaceVinculoAgentes,
  escribirCanal,
  leerCanal,
  MINUTOS_CODIGO_AGENTES,
  VARIABLE_TOKEN_AGENTES,
  type CanalAgentes,
} from "./canal-reglas";

/**
 * El canal de Telegram de los agentes (lo que toca red y base). El token sale de la variable
 * `TELEGRAM_AGENTES_BOT_TOKEN`; el resto vive en `SystemSettings`. Nunca loguea el token, el
 * secreto ni el chat. Nada lanza: devuelve un resultado.
 */

export type ResultadoCanal = { ok: true; mensaje: string } | { ok: false; mensaje: string };

export const MENSAJES_CANAL = {
  sinToken: `Falta la variable ${VARIABLE_TOKEN_AGENTES} en Vercel (el token del bot de agentes que da @BotFather).`,
  tokenRechazado: `Telegram no reconoció el token de ${VARIABLE_TOKEN_AGENTES}. Revisá que esté completo.`,
  sinDireccion: "Falta la dirección pública de FOTOFFICE (NEXT_PUBLIC_APP_URL): sin ella Telegram no sabe a dónde avisar.",
  webhook: "Guardamos el bot, pero Telegram no aceptó la dirección de avisos. Probá de nuevo en un rato.",
  sinCanal: "Primero conectá el bot.",
  fallo: "No se pudo guardar la configuración del canal.",
} as const;

export function tokenAgentes(): string | null {
  return process.env[VARIABLE_TOKEN_AGENTES]?.trim() || null;
}

export async function leerCanalAgentes(): Promise<CanalAgentes | null> {
  try {
    const fila = await prisma.systemSettings.findUnique({ where: { key: CLAVE_CANAL_AGENTES }, select: { value: true } });
    return leerCanal(fila?.value);
  } catch {
    console.error("[agentes] no se pudo leer el canal de Telegram");
    return null;
  }
}

async function guardarCanal(canal: CanalAgentes): Promise<void> {
  const value = escribirCanal(canal);
  await prisma.systemSettings.upsert({
    where: { key: CLAVE_CANAL_AGENTES },
    create: { key: CLAVE_CANAL_AGENTES, value, description: "Canal de Telegram de los agentes de FOTOFFICE (sin el token)" },
    update: { value },
  });
}

export function urlWebhookAgentes(origen: string): string {
  return `${origen.replace(/\/+$/, "")}/api/webhooks/telegram-agentes`;
}

export type DepsCanal = DepsTelegramApi & { ahora?: () => Date; origen?: string; token?: string | null };

/**
 * Conectar (o reconectar): valida el token con `getMe`, registra el webhook con un secreto nuevo
 * y deja un código de vínculo de 30 minutos. Si el bot es el mismo, el chat sigue vinculado.
 */
export async function conectarCanalAgentes(deps: DepsCanal = {}): Promise<ResultadoCanal> {
  const token = deps.token === undefined ? tokenAgentes() : deps.token;
  if (!token) return { ok: false, mensaje: MENSAJES_CANAL.sinToken };
  const origen = deps.origen ?? appUrl();
  if (!origen) return { ok: false, mensaje: MENSAJES_CANAL.sinDireccion };
  const bot = await datosDelBot(token, deps);
  if (!bot.ok) return { ok: false, mensaje: MENSAJES_CANAL.tokenRechazado };

  const ahora = (deps.ahora ?? (() => new Date()))();
  const actual = await leerCanalAgentes();
  const mismoBot = actual?.botId === bot.resultado.id;
  const secreto = secretoNuevo();
  const canal: CanalAgentes = {
    botId: bot.resultado.id,
    botUsername: bot.resultado.username,
    chatId: mismoBot ? (actual?.chatId ?? null) : null,
    chatNombre: mismoBot ? (actual?.chatNombre ?? null) : null,
    linkedAt: mismoBot ? (actual?.linkedAt ?? null) : null,
    webhookSecretHash: hashDeSecreto(secreto),
    linkCode: codigoDeVinculo(),
    linkCodeExpiresAt: new Date(ahora.getTime() + MINUTOS_CODIGO_AGENTES * 60_000).toISOString(),
  };
  try {
    await guardarCanal(canal);
  } catch {
    return { ok: false, mensaje: MENSAJES_CANAL.fallo };
  }
  const w = await registrarWebhook(token, urlWebhookAgentes(origen), secreto, deps);
  if (!w.ok) return { ok: false, mensaje: MENSAJES_CANAL.webhook };
  return { ok: true, mensaje: `Conectado con @${bot.resultado.username}. Tocá el enlace para vincular tu chat.` };
}

export async function nuevoCodigoAgentes(deps: DepsCanal = {}): Promise<ResultadoCanal> {
  const canal = await leerCanalAgentes();
  if (!canal) return { ok: false, mensaje: MENSAJES_CANAL.sinCanal };
  const ahora = (deps.ahora ?? (() => new Date()))();
  try {
    await guardarCanal({ ...canal, linkCode: codigoDeVinculo(), linkCodeExpiresAt: new Date(ahora.getTime() + MINUTOS_CODIGO_AGENTES * 60_000).toISOString() });
  } catch {
    return { ok: false, mensaje: MENSAJES_CANAL.fallo };
  }
  return { ok: true, mensaje: "Enlace nuevo listo (vale 30 minutos)." };
}

export const TEXTOS_VINCULO_AGENTES = {
  VINCULADO: "¡Listo! Este chat quedó vinculado a los agentes de FOTOFFICE. Acá te van a llegar las notas del Periodista para aprobar.",
  YA_VINCULADO: "Este chat ya está vinculado. Acá te llegan las propuestas de los agentes.",
} as const;

/** `/start <código>`: vincula el chat si corresponde y le contesta. A un chat desconocido, silencio. */
export async function vincularChatAgentes(
  canal: CanalAgentes,
  datos: { chatId: string; chatPrivado: boolean; codigo: string | null; nombre: string | null },
  token: string,
  deps: DepsCanal = {},
): Promise<void> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const decision = decidirVinculo(canal, datos, ahora);
  if (decision === "IGNORAR") return;
  if (decision === "VINCULAR") {
    // Releer y confirmar que el código sigue siendo el mismo (es de un solo uso).
    const actual = await leerCanalAgentes();
    if (!actual || codigoVigente(actual, ahora) !== datos.codigo) return;
    await guardarCanal({ ...actual, chatId: datos.chatId, chatNombre: datos.nombre, linkedAt: ahora.toISOString(), linkCode: null, linkCodeExpiresAt: null });
    await mandarMensaje(token, datos.chatId, TEXTOS_VINCULO_AGENTES.VINCULADO, null, deps);
    return;
  }
  await mandarMensaje(token, datos.chatId, TEXTOS_VINCULO_AGENTES.YA_VINCULADO, null, deps);
}

export type EstadoCanalAgentes = {
  tieneToken: boolean;
  conectado: boolean;
  botUsername: string | null;
  vinculado: boolean;
  chatNombre: string | null;
  enlaceVinculo: string | null;
};

/** Para la página Agentes: nunca el token ni el secreto. */
export async function estadoCanalAgentes(ahora: Date = new Date()): Promise<EstadoCanalAgentes> {
  const canal = await leerCanalAgentes();
  const codigo = canal ? codigoVigente(canal, ahora) : null;
  return {
    tieneToken: tokenAgentes() !== null,
    conectado: canal !== null,
    botUsername: canal?.botUsername ?? null,
    vinculado: Boolean(canal?.chatId),
    chatNombre: canal?.chatNombre ?? null,
    enlaceVinculo: canal && codigo ? enlaceVinculoAgentes(canal.botUsername, codigo) : null,
  };
}

/** Lo que necesita un agente para escribirle a Daniel: token + chat vinculado. */
export async function destinoAgentes(): Promise<{ token: string; chatId: string } | null> {
  const token = tokenAgentes();
  if (!token) return null;
  const canal = await leerCanalAgentes();
  if (!canal?.chatId) return null;
  return { token, chatId: canal.chatId };
}

/**
 * Manda una propuesta: con foto si hay (leyenda ≤ 1024) y, si Telegram no acepta la foto, el texto
 * solo. Devuelve el id del mensaje.
 */
export async function mandarPropuesta(
  destino: { token: string; chatId: string },
  contenido: { fotoUrl: string | null; leyenda: string; texto: string; teclado: TecladoTelegram },
  deps: DepsTelegramApi = {},
): Promise<string | null> {
  if (contenido.fotoUrl && contenido.leyenda.length <= MAX_LEYENDA_FOTO) {
    const f = await mandarFoto(destino.token, destino.chatId, contenido.fotoUrl, contenido.leyenda, contenido.teclado, deps);
    if (f.ok) return f.resultado.messageId;
  }
  const m = await mandarMensaje(destino.token, destino.chatId, contenido.texto, contenido.teclado, deps);
  return m.ok ? m.resultado.messageId : null;
}

export { cambiarBotones, contestarBoton, mandarMensaje };

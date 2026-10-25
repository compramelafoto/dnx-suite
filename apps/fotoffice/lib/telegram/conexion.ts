import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { appUrl } from "@/lib/app-url";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { borrarTokenTelegram, guardarTokenTelegram, hayTokenTelegram, leerTokenTelegram } from "@/lib/integrations/telegram/credentials";
import { borrarWebhook, datosDelBot, mandarMensaje, registrarWebhook, tokenConForma, type DepsTelegramApi, type TecladoTelegram } from "./api";
import { codigoDeVinculo, hashDeSecreto, secretoNuevo } from "./webhook";

/**
 * La conexión con Telegram de una institución (spec 2026-10-25 §3): el bot que creó con
 * @BotFather y el chat privado que recibe los avisos. El token vive cifrado en el baúl; acá sólo
 * quedan el bot, el chat, el código de vínculo y el hash del secreto del webhook.
 *
 * Todo tolera que la tabla falte (el SQL todavía no se aplicó): leer devuelve "sin conexión".
 * Nunca loguea el token, el secreto ni el chat.
 */

export const MINUTOS_CODIGO = 30;

export const MENSAJES_TELEGRAM = {
  sinPermiso: "Sólo el dueño o un administrador pueden conectar Telegram.",
  token: "Ese no parece un token de @BotFather. Copialo entero: son números, dos puntos y letras (por ejemplo 123456789:AAH…).",
  tokenRechazado: "Telegram no reconoció ese token. Revisá que lo hayas copiado completo, o pedile uno nuevo a @BotFather con /token.",
  sinDireccion: "Falta la dirección pública de FOTOFFICE (NEXT_PUBLIC_APP_URL): sin ella Telegram no sabe a dónde avisar.",
  webhook: "Guardamos el bot, pero Telegram no aceptó la dirección de avisos. Probá de nuevo en un rato.",
  sinClave: "No se pudo guardar el token: falta configurar la clave de cifrado del servidor.",
  sinConexion: "Primero conectá el bot.",
  fallo: "No se pudo guardar. ¿Ya se aplicó el SQL del presupuesto automático?",
} as const;

export type ConexionTelegram = {
  id: string;
  workspaceId: string;
  botId: string;
  botUsername: string;
  chatId: string | null;
  chatNombre: string | null;
  linkCode: string | null;
  linkCodeExpiresAt: Date | null;
  webhookSecretHash: string;
  linkedAt: Date | null;
};

export type ResultadoTelegram = { ok: true } | { ok: false; error: string };
const no = (error: string): ResultadoTelegram => ({ ok: false, error });

function registrar(donde: string, e: unknown): void {
  const codigo = (e as { code?: unknown } | null)?.code;
  if (codigo === "P2021") console.warn(`[telegram] ${donde}: falta aplicar el SQL del presupuesto automático`);
  else console.error(`[telegram] ${donde} falló`, { codigo: typeof codigo === "string" ? codigo : null });
}

const SELECCION = {
  id: true, workspaceId: true, botId: true, botUsername: true, chatId: true, chatNombre: true,
  linkCode: true, linkCodeExpiresAt: true, webhookSecretHash: true, linkedAt: true,
} as const;

export async function leerConexionTelegram(workspaceId: string): Promise<ConexionTelegram | null> {
  try {
    return await prisma.fotofficeTelegramConexion.findUnique({ where: { workspaceId }, select: SELECCION });
  } catch (e) {
    registrar("leerConexionTelegram", e);
    return null;
  }
}

/** Para el webhook: la conexión por su id (va en la dirección del webhook). */
export async function conexionPorId(conexionId: string): Promise<ConexionTelegram | null> {
  if (!/^[a-z0-9]{8,40}$/i.test(conexionId)) return null;
  try {
    return await prisma.fotofficeTelegramConexion.findUnique({ where: { id: conexionId }, select: SELECCION });
  } catch (e) {
    registrar("conexionPorId", e);
    return null;
  }
}

export function urlDelWebhook(origen: string, conexionId: string): string {
  return `${origen.replace(/\/+$/, "")}/api/webhooks/telegram/${encodeURIComponent(conexionId)}`;
}

/** Enlace para vincular el chat: abre el bot con el botón "Iniciar", que manda `/start <código>`. */
export function enlaceDeVinculo(botUsername: string, codigo: string): string {
  return `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(codigo)}`;
}

export type DepsConexionTelegram = DepsTelegramApi & { ahora?: () => Date; origen?: string };

const puedeConfigurar = (ctx: CtxConsultas) => ctx.userId !== null && puedeEnContexto(ctx, "configurar");

/**
 * Conectar (o reemplazar) el bot: valida el token con `getMe`, guarda la fila con un secreto y un
 * código de vínculo nuevos, cifra el token y registra el webhook. Si el bot es otro, el chat se
 * desvincula (hay que volver a tocar "Iniciar").
 */
export async function conectarTelegram(ctx: CtxConsultas, tokenCrudo: unknown, deps: DepsConexionTelegram = {}): Promise<ResultadoTelegram> {
  if (!puedeConfigurar(ctx)) return no(MENSAJES_TELEGRAM.sinPermiso);
  const token = typeof tokenCrudo === "string" ? tokenCrudo.trim() : "";
  if (!tokenConForma(token)) return no(MENSAJES_TELEGRAM.token);
  const origen = deps.origen ?? appUrl();
  if (!origen) return no(MENSAJES_TELEGRAM.sinDireccion);

  const bot = await datosDelBot(token, deps);
  if (!bot.ok) return no(MENSAJES_TELEGRAM.tokenRechazado);

  const ahora = (deps.ahora ?? (() => new Date()))();
  const secreto = secretoNuevo();
  const codigo = codigoDeVinculo();
  const vence = new Date(ahora.getTime() + MINUTOS_CODIGO * 60_000);
  const { workspaceId } = ctx;

  let fila: { id: string };
  try {
    const actual = await prisma.fotofficeTelegramConexion.findUnique({ where: { workspaceId }, select: { botId: true } });
    const mismoBot = actual?.botId === bot.resultado.id;
    const datos = {
      botId: bot.resultado.id,
      botUsername: bot.resultado.username,
      webhookSecretHash: hashDeSecreto(secreto),
      linkCode: codigo,
      linkCodeExpiresAt: vence,
      connectedByUserId: ctx.userId,
      ...(mismoBot ? {} : { chatId: null, chatNombre: null, linkedAt: null }),
    };
    fila = await prisma.fotofficeTelegramConexion.upsert({
      where: { workspaceId },
      create: { workspaceId, ...datos },
      update: datos,
      select: { id: true },
    });
  } catch (e) {
    registrar("conectarTelegram", e);
    return no(MENSAJES_TELEGRAM.fallo);
  }
  try {
    await guardarTokenTelegram(workspaceId, token, bot.resultado.username, ctx.userId);
  } catch {
    return no(MENSAJES_TELEGRAM.sinClave);
  }
  const w = await registrarWebhook(token, urlDelWebhook(origen, fila.id), secreto, deps);
  if (!w.ok) return no(MENSAJES_TELEGRAM.webhook);
  return { ok: true };
}

/** Un código de vínculo nuevo (el anterior venció o se quiere vincular otro celular). */
export async function nuevoCodigoTelegram(ctx: CtxConsultas, deps: DepsConexionTelegram = {}): Promise<ResultadoTelegram> {
  if (!puedeConfigurar(ctx)) return no(MENSAJES_TELEGRAM.sinPermiso);
  const ahora = (deps.ahora ?? (() => new Date()))();
  try {
    const r = await prisma.fotofficeTelegramConexion.updateMany({
      where: { workspaceId: ctx.workspaceId },
      data: { linkCode: codigoDeVinculo(), linkCodeExpiresAt: new Date(ahora.getTime() + MINUTOS_CODIGO * 60_000) },
    });
    return r.count === 1 ? { ok: true } : no(MENSAJES_TELEGRAM.sinConexion);
  } catch (e) {
    registrar("nuevoCodigoTelegram", e);
    return no(MENSAJES_TELEGRAM.fallo);
  }
}

/** Desconectar: Telegram deja de mandar avisos (best effort), se borran la fila y el token. */
export async function desconectarTelegram(ctx: CtxConsultas, deps: DepsConexionTelegram = {}): Promise<ResultadoTelegram> {
  if (!puedeConfigurar(ctx)) return no(MENSAJES_TELEGRAM.sinPermiso);
  const token = await leerTokenTelegram(ctx.workspaceId);
  if (token) await borrarWebhook(token, deps);
  try {
    await prisma.fotofficeTelegramConexion.deleteMany({ where: { workspaceId: ctx.workspaceId } });
    await borrarTokenTelegram(ctx.workspaceId);
  } catch (e) {
    registrar("desconectarTelegram", e);
    return no(MENSAJES_TELEGRAM.fallo);
  }
  return { ok: true };
}

export type ResultadoVinculo = "VINCULADO" | "YA_VINCULADO" | "CODIGO_INVALIDO" | "NO_PRIVADO";

/**
 * `/start <código>` desde un chat privado: si el código es el de la conexión y no venció, ese chat
 * pasa a recibir los avisos y el código se borra (es de un solo uso). Un `/start` del chat que ya
 * está vinculado responde "ya vinculado" sin tocar nada.
 */
export async function vincularChat(
  conexion: ConexionTelegram,
  datos: { chatId: string; chatPrivado: boolean; codigo: string | null; nombre: string | null },
  ahora: Date,
): Promise<ResultadoVinculo> {
  if (!datos.chatPrivado) return "NO_PRIVADO";
  if (conexion.chatId === datos.chatId && !datos.codigo) return "YA_VINCULADO";
  if (!datos.codigo || !conexion.linkCode || datos.codigo !== conexion.linkCode) {
    return conexion.chatId === datos.chatId ? "YA_VINCULADO" : "CODIGO_INVALIDO";
  }
  if (!conexion.linkCodeExpiresAt || conexion.linkCodeExpiresAt.getTime() < ahora.getTime()) return "CODIGO_INVALIDO";
  const r = await prisma.fotofficeTelegramConexion.updateMany({
    where: { id: conexion.id, linkCode: datos.codigo },
    data: { chatId: datos.chatId, chatNombre: datos.nombre, linkedAt: ahora, linkCode: null, linkCodeExpiresAt: null },
  });
  return r.count === 1 ? "VINCULADO" : "CODIGO_INVALIDO";
}

export type EstadoTelegram = {
  conectado: boolean;
  tieneToken: boolean;
  botUsername: string | null;
  vinculado: boolean;
  chatNombre: string | null;
  /** Enlace para tocar "Iniciar", mientras el código siga vigente. */
  enlaceVinculo: string | null;
  codigo: string | null;
};

/** Para la pantalla: nunca el token ni el secreto. */
export async function estadoTelegram(workspaceId: string, ahora: Date = new Date()): Promise<EstadoTelegram> {
  const [c, tieneToken] = await Promise.all([leerConexionTelegram(workspaceId), hayTokenTelegram(workspaceId)]);
  if (!c) return { conectado: false, tieneToken, botUsername: null, vinculado: false, chatNombre: null, enlaceVinculo: null, codigo: null };
  const vigente = c.linkCode && c.linkCodeExpiresAt && c.linkCodeExpiresAt.getTime() > ahora.getTime() ? c.linkCode : null;
  return {
    conectado: true,
    tieneToken,
    botUsername: c.botUsername,
    vinculado: c.chatId !== null,
    chatNombre: c.chatNombre,
    enlaceVinculo: vigente ? enlaceDeVinculo(c.botUsername, vigente) : null,
    codigo: vigente,
  };
}

export type DepsAvisoTelegram = DepsTelegramApi & {
  leerToken?: (workspaceId: string) => Promise<string | null>;
  conexion?: (workspaceId: string) => Promise<ConexionTelegram | null>;
};

export type ResultadoAvisoTelegram = { ok: true; chatId: string; messageId: string } | { ok: false; codigo: string };

/** Manda un mensaje al chat vinculado. Nunca lanza. */
export async function avisarPorTelegram(
  workspaceId: string,
  html: string,
  teclado: TecladoTelegram | null,
  deps: DepsAvisoTelegram = {},
): Promise<ResultadoAvisoTelegram> {
  try {
    const c = await (deps.conexion ?? leerConexionTelegram)(workspaceId);
    if (!c) return { ok: false, codigo: "SIN_CONEXION" };
    if (!c.chatId) return { ok: false, codigo: "SIN_CHAT" };
    const token = await (deps.leerToken ?? leerTokenTelegram)(workspaceId);
    if (!token) return { ok: false, codigo: "SIN_TOKEN" };
    const r = await mandarMensaje(token, c.chatId, html, teclado, deps);
    if (!r.ok) return r;
    return { ok: true, chatId: c.chatId, messageId: r.resultado.messageId };
  } catch {
    return { ok: false, codigo: "INTERNO" };
  }
}

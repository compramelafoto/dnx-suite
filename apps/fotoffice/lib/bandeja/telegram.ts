import "server-only";
import { prisma } from "@repo/db";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede } from "@/lib/access/policy";
import { appUrl } from "@/lib/app-url";
import { clientDisplayName } from "@/lib/clients/display";
import { leerTokenTelegram } from "@/lib/integrations/telegram/credentials";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { cambiarBotones, contestarBoton, mandarMensaje, responderMensaje, type TecladoTelegram } from "@/lib/telegram/api";
import { leerConexionTelegram, type ConexionTelegram } from "@/lib/telegram/conexion";
import type { UpdateTelegram } from "@/lib/telegram/webhook";
import { MENSAJES_BANDEJA, type CtxBandeja } from "./acceso";
import { derivar, resolver, responder, tomar } from "./acciones";
import { BANDEJA_MODULE_KEY } from "./constantes";
import { personasDeLaBandeja, type PersonaDeLaBandeja } from "./equipo";
import { esperaDe } from "./espera";
import { detalleDeError } from "./registro";
import { VENTANA_HORAS } from "./reglas";
import { generarResumen } from "./resumen";
import { avisoDeMensaje, botonesDelChat, botonesDerivar, botonTomarYEnviar, escapar, leerBotonBandeja, tarjetaDeDerivacion, type UltimoMensaje } from "./telegram-puro";

/**
 * Telegram para los chats de la Bandeja asignados al dueño del chat de Telegram (§7 del diseño
 * 2026-11-24). Usa el bot de la institución (`FotofficeTelegramConexion`). Cada mensaje que el bot
 * manda por la Bandeja queda en `FotofficeWaTelegramAviso` atado a su chat: al citarlo, la
 * respuesta va a ESE chat y a ningún otro. Todo corre en `after()` y NUNCA lanza; los errores se
 * registran sin textos ni teléfonos.
 */

const HORA_MS = 3_600_000;
const ESPERA_RESUMEN_MS = 8_000;
const MENSAJE_SOLO_TEXTO = "Por ahora desde Telegram sólo se puede mandar texto.";

export type ApiBandejaTelegram = {
  mandar: (token: string, chatId: string, html: string, teclado: TecladoTelegram | null, responderA?: string) => Promise<string | null>;
  contestar: (token: string, callbackId: string, texto: string) => Promise<void>;
  botones: (token: string, chatId: string, messageId: string, teclado: TecladoTelegram | null) => Promise<void>;
};

const API_REAL: ApiBandejaTelegram = {
  mandar: async (token, chatId, html, teclado, responderA) => {
    const r = responderA ? await responderMensaje(token, chatId, html, responderA, teclado) : await mandarMensaje(token, chatId, html, teclado);
    return r.ok ? r.resultado.messageId : null;
  },
  contestar: async (token, callbackId, texto) => {
    await contestarBoton(token, callbackId, texto);
  },
  botones: async (token, chatId, messageId, teclado) => {
    await cambiarBotones(token, chatId, messageId, teclado);
  },
};

export type DepsTelegramBandeja = {
  api?: Partial<ApiBandejaTelegram>;
  leerToken?: (workspaceId: string) => Promise<string | null>;
  conexionDe?: (workspaceId: string) => Promise<ConexionTelegram | null>;
  ctxDe?: (conexion: ConexionTelegram) => Promise<CtxBandeja | null>;
  personas?: (workspaceId: string) => Promise<PersonaDeLaBandeja[]>;
  responder?: typeof responder;
  derivar?: typeof derivar;
  resolver?: typeof resolver;
  tomar?: typeof tomar;
  resumir?: (workspaceId: string, chatId: string) => Promise<string | null>;
  ahora?: Date;
  origen?: string;
};

const api = (d: DepsTelegramBandeja): ApiBandejaTelegram => ({ ...API_REAL, ...d.api });
const urlDelChat = (d: DepsTelegramBandeja, chatId: string) => `${d.origen ?? appUrl()}/bandeja/${chatId}`;
const registrarError = (donde: string, e: unknown) => console.error(`[fotoffice][bandeja][telegram] ${donde}`, detalleDeError(e));

/** El contexto de la Bandeja para el dueño del chat de Telegram: su rol y su acceso reales, con Gestionar. */
export async function ctxDeConexion(conexion: ConexionTelegram): Promise<CtxBandeja | null> {
  const userId = conexion.connectedByUserId;
  if (userId === null) return null;
  const [user, encendido] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    isModuleEnabledForWorkspace(conexion.workspaceId, BANDEJA_MODULE_KEY),
  ]);
  if (!user || !encendido) return null;
  const acceso = await resolverAcceso(userId, conexion.workspaceId);
  if (!puede(acceso, "operar", BANDEJA_MODULE_KEY)) return null;
  return { workspaceId: conexion.workspaceId, userId, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso } as CtxBandeja;
}

type ChatParaTelegram = {
  id: string; canal: string; waId: string; nombre: string | null; usuarioInstagram: string | null; clientId: string | null;
  estado: string; asignadoUserId: number | null; ultimoEntranteEn: Date | null; ultimoMensajeEn: Date;
};

async function chatDe(workspaceId: string, chatId: string): Promise<ChatParaTelegram | null> {
  return (await prisma.fotofficeWaChat.findFirst({
    where: { id: chatId, workspaceId },
    select: { id: true, canal: true, waId: true, nombre: true, usuarioInstagram: true, clientId: true, estado: true, asignadoUserId: true, ultimoEntranteEn: true, ultimoMensajeEn: true },
  })) as ChatParaTelegram | null;
}

/** El nombre del chat para Telegram: el cliente vinculado, el perfil, el @usuario o el número. */
async function tituloDe(workspaceId: string, c: ChatParaTelegram): Promise<string> {
  if (c.clientId) {
    const cliente = await prisma.client.findFirst({ where: { id: c.clientId, workspaceId }, select: { kind: true, firstName: true, lastName: true, businessName: true } });
    if (cliente) return clientDisplayName(cliente as Parameters<typeof clientDisplayName>[0]);
  }
  if (c.canal === "INSTAGRAM") return c.usuarioInstagram ? `@${c.usuarioInstagram}` : (c.nombre?.trim() || "Instagram");
  return c.nombre?.trim() || `+${c.waId}`;
}

/** Manda al chat vinculado y deja el aviso atado al chat de la Bandeja. Devuelve el id del mensaje de Telegram. */
async function mandarYRegistrar(
  conexion: ConexionTelegram, token: string, chatId: string, html: string, teclado: TecladoTelegram | null, d: DepsTelegramBandeja, responderA?: string,
): Promise<string | null> {
  if (!conexion.chatId) return null;
  const messageId = await api(d).mandar(token, conexion.chatId, html, teclado, responderA);
  if (!messageId) return null;
  await prisma.fotofficeWaTelegramAviso
    .create({ data: { workspaceId: conexion.workspaceId, conexionId: conexion.id, chatId, telegramChatId: conexion.chatId, telegramMessageId: messageId } })
    .catch((e: unknown) => registrarError("no se pudo registrar el aviso", e));
  return messageId;
}

/** Conexión lista para la Bandeja de este workspace y su token, o `null`. */
async function conexionLista(workspaceId: string, d: DepsTelegramBandeja): Promise<{ conexion: ConexionTelegram; token: string } | null> {
  const conexion = await (d.conexionDe ?? leerConexionTelegram)(workspaceId);
  if (!conexion || !conexion.chatId || !conexion.bandejaActiva || conexion.connectedByUserId === null) return null;
  const token = await (d.leerToken ?? leerTokenTelegram)(workspaceId);
  if (!token) return null;
  return { conexion, token };
}

/** ¿El chat lo atiende ahora el dueño del Telegram? */
const esDelDueno = (chat: ChatParaTelegram, conexion: ConexionTelegram) => chat.estado === "HUMANO" && chat.asignadoUserId !== null && chat.asignadoUserId === conexion.connectedByUserId;

/**
 * Tarjeta al quedar el chat asignado al dueño del Telegram por OTRA persona (§7.2.1). Espera el
 * resumen hasta 8 s; si no llega, sale sin él. `quienUserId` es quien derivó.
 */
export async function avisarDerivacion(workspaceId: string, chatId: string, quien: { userId: number | null; nombre: string | null }, d: DepsTelegramBandeja = {}): Promise<void> {
  try {
    const lista = await conexionLista(workspaceId, d);
    if (!lista) return;
    const { conexion, token } = lista;
    if (quien.userId !== null && quien.userId === conexion.connectedByUserId) return; // se lo tomó él mismo
    const chat = await chatDe(workspaceId, chatId);
    if (!chat || !esDelDueno(chat, conexion)) return;

    const resumen = await Promise.race([
      (d.resumir ?? ((w: string, c: string) => generarResumen(w, c)))(workspaceId, chatId).catch(() => null),
      new Promise<null>((ok) => setTimeout(() => ok(null), ESPERA_RESUMEN_MS)),
    ]);
    const ahora = d.ahora ?? new Date();
    const filas = (await prisma.fotofficeWaMensaje.findMany({
      where: { chatId, workspaceId, direccion: { in: ["ENTRANTE", "SALIENTE"] } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { direccion: true, autor: true, autorLabel: true, tipo: true, texto: true },
    })) as { direccion: string; autor: string; autorLabel: string | null; tipo: string; texto: string | null }[];
    const ultimos: UltimoMensaje[] = filas.reverse().map((m) => ({
      deCliente: m.direccion === "ENTRANTE",
      autor: m.direccion === "ENTRANTE" ? null : m.autor === "BOT" ? "Bot" : (m.autorLabel ?? "Equipo"),
      texto: m.texto?.trim() || `[${m.tipo.toLowerCase()}]`,
    }));
    const espera = esperaDe({ estado: chat.estado, atiendeElBot: false, ultimoEntranteEn: chat.ultimoEntranteEn, ultimoMensajeEn: chat.ultimoMensajeEn }, ahora);
    const cierre = chat.ultimoEntranteEn ? new Date(chat.ultimoEntranteEn.getTime() + VENTANA_HORAS * HORA_MS) : null;
    const html = tarjetaDeDerivacion({
      quien: quien.nombre,
      titulo: await tituloDe(workspaceId, chat),
      canal: chat.canal === "INSTAGRAM" ? "INSTAGRAM" : "WHATSAPP",
      campana: null,
      resumen: resumen ?? (await prisma.fotofficeWaChat.findFirst({ where: { id: chatId, workspaceId }, select: { resumen: true } }))?.resumen ?? null,
      ultimos,
      esperaMinutos: espera?.minutos ?? null,
      ventanaHasta: cierre && cierre.getTime() > ahora.getTime() ? cierre : null,
    });
    await mandarYRegistrar(conexion, token, chatId, html, botonesDelChat(chatId, urlDelChat(d, chatId)), d);
  } catch (e) {
    registrarError("no se pudo avisar la derivación", e);
  }
}

/** Cada mensaje nuevo del cliente mientras el chat siga asignado al dueño del Telegram (§7.2.2). */
export async function avisarEntrante(workspaceId: string, chatId: string, mensajeId: string, d: DepsTelegramBandeja = {}): Promise<void> {
  try {
    const lista = await conexionLista(workspaceId, d);
    if (!lista) return;
    const chat = await chatDe(workspaceId, chatId);
    if (!chat || !esDelDueno(chat, lista.conexion)) return;
    const m = (await prisma.fotofficeWaMensaje.findFirst({ where: { id: mensajeId, chatId, workspaceId, direccion: "ENTRANTE" }, select: { tipo: true, texto: true } })) as {
      tipo: string; texto: string | null;
    } | null;
    if (!m) return;
    const html = avisoDeMensaje(await tituloDe(workspaceId, chat), m.tipo, m.texto);
    await mandarYRegistrar(lista.conexion, lista.token, chatId, html, botonesDelChat(chatId, urlDelChat(d, chatId)), d);
  } catch (e) {
    registrarError("no se pudo reenviar un mensaje", e);
  }
}

/** Avisa los entrantes de varios chats (lo que devuelve el registro del webhook). */
export async function avisarEntrantes(lista: readonly { workspaceId: string; chatId: string; mensajeId: string }[], d: DepsTelegramBandeja = {}): Promise<void> {
  for (const e of lista) await avisarEntrante(e.workspaceId, e.chatId, e.mensajeId, d);
}

/** ¿Viene del chat privado vinculado? Cualquier otro chat de Telegram se ignora. */
const delChatVinculado = (conexion: ConexionTelegram, chatId: string | null, deId: string | null) =>
  conexion.chatId !== null && chatId === conexion.chatId && deId === conexion.chatId;

async function nombreDe(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  return u ? etiquetaDeUsuario(u) : "otra persona";
}

/** Envía lo que se escribió y le cuenta al dueño cómo salió, citando su mensaje. */
async function enviarYContar(
  conexion: ConexionTelegram, token: string, ctx: CtxBandeja, chat: ChatParaTelegram, texto: string, clientToken: string, citar: string | undefined, d: DepsTelegramBandeja,
): Promise<void> {
  const r = await (d.responder ?? responder)(ctx, chat.id, texto, clientToken);
  const titulo = escapar(await tituloDe(conexion.workspaceId, chat));
  if (r.ok) {
    const extra = r.aviso ? `\n${escapar(r.aviso)}` : r.estadoEnvio === "SIMULADO" ? "\n(modo de prueba: no salió a WhatsApp)" : "";
    await mandarYRegistrar(conexion, token, chat.id, `✅ Enviado a ${titulo}${extra}`, botonesDelChat(chat.id, urlDelChat(d, chat.id)), d, citar);
    return;
  }
  const fuera = r.error === MENSAJES_BANDEJA.fueraDeVentana || r.error === MENSAJES_BANDEJA.fueraDeVentanaInstagram;
  const teclado: TecladoTelegram = fuera ? { inline_keyboard: [[{ text: "Abrir en FOTOFFICE", url: urlDelChat(d, chat.id) }]] } : botonesDelChat(chat.id, urlDelChat(d, chat.id));
  await mandarYRegistrar(conexion, token, chat.id, `⚠️ No se pudo enviar: ${escapar(r.error)}`, teclado, d, citar);
}

/**
 * Una respuesta citando un mensaje del bot (§7.3). Sólo del chat vinculado y citando un aviso de
 * la Bandeja de ESTA conexión; lo demás se ignora. Si el chat ahora lo atiende otra persona, no se
 * envía: queda pendiente con «Tomarlo y enviar». El `clientToken` sale del id del mensaje de
 * Telegram: un reintento de Telegram no manda dos veces.
 */
export async function atenderRespuesta(conexion: ConexionTelegram, update: UpdateTelegram, d: DepsTelegramBandeja = {}): Promise<boolean> {
  if (update.tipo !== "RESPUESTA" && update.tipo !== "RESPUESTA_NO_TEXTO") return false;
  try {
    if (!delChatVinculado(conexion, update.chatId, update.deId)) return false;
    // El aviso se busca en ESTE chat de Telegram: los números de mensaje se repiten entre chats.
    const aviso = await prisma.fotofficeWaTelegramAviso.findUnique({
      where: { conexionId_telegramChatId_telegramMessageId: { conexionId: conexion.id, telegramChatId: update.chatId, telegramMessageId: update.respondeA } },
    });
    if (!aviso || aviso.workspaceId !== conexion.workspaceId) return false; // cita otra cosa (p. ej. una cotización)
    const token = await (d.leerToken ?? leerTokenTelegram)(conexion.workspaceId);
    if (!token || !conexion.chatId) return true;
    const citar = update.tipo === "RESPUESTA" ? (update.messageId ?? undefined) : undefined;
    const contar = (html: string, teclado: TecladoTelegram | null = null) => api(d).mandar(token, conexion.chatId!, html, teclado, citar).then(() => undefined);

    if (update.tipo === "RESPUESTA_NO_TEXTO") {
      await contar(MENSAJE_SOLO_TEXTO);
      return true;
    }
    if (!update.messageId) return true;
    const ctx = await (d.ctxDe ?? ctxDeConexion)(conexion);
    if (!ctx) {
      await contar(escapar(MENSAJES_BANDEJA.sinPermiso));
      return true;
    }
    const chat = await chatDe(conexion.workspaceId, aviso.chatId);
    if (!chat) {
      await contar(escapar(MENSAJES_BANDEJA.noExiste));
      return true;
    }
    if (chat.estado === "HUMANO" && chat.asignadoUserId !== null && chat.asignadoUserId !== ctx.userId) {
      await prisma.fotofficeWaTelegramAviso.update({ where: { id: aviso.id }, data: { textoPendiente: update.texto, telegramPendienteId: update.messageId, pendienteEn: d.ahora ?? new Date() } });
      await contar(`Ahora lo atiende ${escapar(await nombreDe(chat.asignadoUserId))}. ¿Lo tomás y lo mando?`, botonTomarYEnviar(aviso.id));
      return true;
    }
    await enviarYContar(conexion, token, ctx, chat, update.texto, `tg-${conexion.id}-${update.messageId}`, citar, d);
    return true;
  } catch (e) {
    registrarError("no se pudo atender una respuesta", e);
    return true;
  }
}

/** Botones de la Bandeja (`bj:…`, §7.4). Devuelve `false` si el botón no es de la Bandeja. */
export async function atenderBoton(conexion: ConexionTelegram, update: UpdateTelegram, d: DepsTelegramBandeja = {}): Promise<boolean> {
  if (update.tipo !== "BOTON") return false;
  const boton = leerBotonBandeja(update.data);
  if (!boton) return false;
  try {
    const token = await (d.leerToken ?? leerTokenTelegram)(conexion.workspaceId);
    if (!token) return true;
    const a = api(d);
    const contestar = (texto: string) => a.contestar(token, update.callbackId, texto);
    if (!delChatVinculado(conexion, update.chatId, update.deId)) {
      await contestar(MENSAJES_BANDEJA.sinPermiso);
      return true;
    }
    const ctx = await (d.ctxDe ?? ctxDeConexion)(conexion);
    if (!ctx) {
      await contestar(MENSAJES_BANDEJA.sinPermiso);
      return true;
    }
    const cambiar = (teclado: TecladoTelegram) => (update.messageId && conexion.chatId ? a.botones(token, conexion.chatId, update.messageId, teclado) : Promise.resolve());

    if (boton.accion === "t") {
      const aviso = await prisma.fotofficeWaTelegramAviso.findFirst({ where: { id: boton.avisoId, conexionId: conexion.id, workspaceId: conexion.workspaceId } });
      const ahora = d.ahora ?? new Date();
      if (!aviso?.textoPendiente || !aviso.pendienteEn || ahora.getTime() - aviso.pendienteEn.getTime() > 24 * HORA_MS) {
        await contestar("Ya no hay nada pendiente para enviar.");
        return true;
      }
      const texto = aviso.textoPendiente;
      // El identificador sale del mensaje que quedó pendiente: un doble toque no manda dos veces y un
      // pendiente nuevo sobre la misma tarjeta sí sale.
      const clientToken = `tg-${conexion.id}-${aviso.telegramPendienteId ?? `t-${aviso.id}`}`;
      const tomado = await (d.tomar ?? tomar)(ctx, aviso.chatId);
      if (!tomado.ok) {
        await contestar(tomado.error);
        return true;
      }
      const chat = await chatDe(conexion.workspaceId, aviso.chatId);
      if (!chat) {
        await contestar(MENSAJES_BANDEJA.noExiste);
        return true;
      }
      await contestar("Lo tomaste. Enviando…");
      await enviarYContar(conexion, token, ctx, chat, texto, clientToken, update.messageId ?? undefined, d);
      await prisma.fotofficeWaTelegramAviso.update({ where: { id: aviso.id }, data: { textoPendiente: null, telegramPendienteId: null, pendienteEn: null } });
      return true;
    }

    const chat = await chatDe(conexion.workspaceId, boton.chatId);
    if (!chat) {
      await contestar(MENSAJES_BANDEJA.noExiste);
      return true;
    }
    if (boton.accion === "dv") {
      const personas = (await (d.personas ?? personasDeLaBandeja)(conexion.workspaceId)).filter((p) => p.puedeOperar && p.userId !== ctx.userId);
      await cambiar(botonesDerivar(chat.id, personas));
      await contestar("¿A quién se lo pasás?");
      return true;
    }
    if (boton.accion === "bk") {
      await cambiar(botonesDelChat(chat.id, urlDelChat(d, chat.id)));
      await contestar("Listo");
      return true;
    }
    if (boton.accion === "r") {
      const r = await (d.resolver ?? resolver)(ctx, chat.id);
      await contestar(r.ok ? "Marcado como resuelto" : r.error);
      return true;
    }
    if (boton.accion !== "d") return true;
    const r = await (d.derivar ?? derivar)(ctx, chat.id, boton.destino);
    await cambiar(botonesDelChat(chat.id, urlDelChat(d, chat.id)));
    if (!r.ok) {
      await contestar(r.error);
      return true;
    }
    await contestar(boton.destino === "bot" ? "Se lo pasaste al bot" : `Se lo pasaste a ${await nombreDe(boton.destino)}`);
    // Como desde el panel: al derivar a una persona se arma el resumen para quien lo recibe.
    if (r.cambio && boton.destino !== "bot") await (d.resumir ?? ((w: string, c: string) => generarResumen(w, c)))(conexion.workspaceId, chat.id).catch(() => null);
    return true;
  } catch (e) {
    registrarError("no se pudo atender un botón", e);
    return true;
  }
}

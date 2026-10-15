import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";
import { BOT_PLATFORM } from "../config";
import { HARD_CAP_TURNS, carryOverMessage, countTurns } from "@repo/dnx-bot";
import { appendMessages, loadHistory, type BotActionRow } from "../store";

const OPEN_WINDOW_MS = 6 * 60 * 60 * 1000;
const ACTION_TTL_MS = 60 * 60 * 1000;

export type ConversacionComprador = {
  id: string;
  status: "OPEN" | "ESCALATED" | "CLOSED";
  supportTicketId: number | null;
  buyerEmail: string | null;
  verifiedUntil: Date | null;
  ipHash: string | null;
  albumId: number | null;
  orderId: number | null;
};

const SELECT_CONVERSACION = {
  id: true, status: true, supportTicketId: true, buyerEmail: true, verifiedUntil: true, ipHash: true, albumId: true, orderId: true,
} as const;

const SELECT_ACCION = { id: true, userId: true, toolName: true, input: true, summary: true, conversationId: true } as const;

function aConversacion(r: ConversacionComprador): ConversacionComprador {
  return {
    id: r.id, status: r.status, supportTicketId: r.supportTicketId, buyerEmail: r.buyerEmail,
    verifiedUntil: r.verifiedUntil, ipHash: r.ipHash, albumId: r.albumId, orderId: r.orderId,
  };
}

/** Conversación abierta (o escalada) del navegador en las últimas 6 horas. */
async function buscarAbierta(guestKey: string) {
  return prisma.botConversation.findFirst({
    where: {
      platform: BOT_PLATFORM,
      audience: "BUYER",
      guestKey,
      status: { in: ["OPEN", "ESCALATED"] },
      updatedAt: { gt: new Date(Date.now() - OPEN_WINDOW_MS) },
    },
    orderBy: { updatedAt: "desc" },
    select: SELECT_CONVERSACION,
  });
}

export async function buscarConversacionComprador(guestKey: string): Promise<ConversacionComprador | null> {
  const r = await buscarAbierta(guestKey);
  return r ? aConversacion(r) : null;
}

/**
 * Carga una conversación por id sólo si es de compradores y del mismo navegador (sin ventana de tiempo):
 * la ruta de acciones la usa con `action.conversationId` antes de reclamar la acción.
 */
export async function leerConversacionComprador(conversationId: string, guestKey: string): Promise<ConversacionComprador | null> {
  const r = await prisma.botConversation.findFirst({
    where: { id: conversationId, platform: BOT_PLATFORM, audience: "BUYER", guestKey },
    select: SELECT_CONVERSACION,
  });
  return r ? aConversacion(r) : null;
}

export async function obtenerConversacionComprador(p: {
  guestKey: string; ipHash: string; pagePath: string | null; albumId: number | null; orderId: number | null; model: string;
}): Promise<ConversacionComprador> {
  // Ya no se corta por cantidad de mensajes: lo que viaja al modelo lo acota la ventana del historial.
  const abierta = await buscarAbierta(p.guestKey);
  if (abierta) {
    const c = aConversacion(abierta);
    const cambios: { albumId?: number; orderId?: number } = {};
    if (p.albumId != null && p.albumId !== c.albumId) cambios.albumId = p.albumId;
    if (p.orderId != null && p.orderId !== c.orderId) cambios.orderId = p.orderId;
    if (Object.keys(cambios).length > 0) {
      await prisma.botConversation.update({ where: { id: c.id }, data: cambios });
      Object.assign(c, cambios);
    }
    return c;
  }
  // La verificación dura 24 h aunque la conversación rote: se copia la vigente del mismo navegador.
  const verificada = await prisma.botConversation.findFirst({
    where: { platform: BOT_PLATFORM, audience: "BUYER", guestKey: p.guestKey, verifiedUntil: { gt: new Date() } },
    orderBy: { verifiedUntil: "desc" },
    select: { buyerEmail: true, verifiedUntil: true },
  });
  const creada = await prisma.botConversation.create({
    data: {
      platform: BOT_PLATFORM, audience: "BUYER", userId: null, guestKey: p.guestKey, ipHash: p.ipHash,
      pagePath: p.pagePath, albumId: p.albumId, orderId: p.orderId, model: p.model,
      buyerEmail: verificada?.buyerEmail ?? null, verifiedUntil: verificada?.verifiedUntil ?? null,
    },
    select: SELECT_CONVERSACION,
  });
  return aConversacion(creada);
}

/**
 * El historial del turno. Sólo si la conversación pasó el tope duro (HARD_CAP_TURNS turnos, no
 * filas) se abre otra con lo mismo (verificación, pedido, ticket) que arranca con el resumen de la
 * anterior: para el comprador no hay corte.
 */
export async function continuarConversacionComprador(
  conv: ConversacionComprador,
  p: { guestKey: string; pagePath: string | null; model: string },
): Promise<{ conv: ConversacionComprador; history: unknown[]; rotada: boolean }> {
  const history = await loadHistory(conv.id);
  if (countTurns(history) < HARD_CAP_TURNS) return { conv, history, rotada: false };
  const creada = await prisma.botConversation.create({
    data: {
      platform: BOT_PLATFORM, audience: "BUYER", userId: null, guestKey: p.guestKey, ipHash: conv.ipHash,
      pagePath: p.pagePath, albumId: conv.albumId, orderId: conv.orderId, model: p.model,
      buyerEmail: conv.buyerEmail, verifiedUntil: conv.verifiedUntil, status: conv.status, supportTicketId: conv.supportTicketId,
    },
    select: SELECT_CONVERSACION,
  });
  const arrastre = carryOverMessage(history);
  await appendMessages(creada.id, [arrastre]);
  return { conv: aConversacion(creada), history: [arrastre], rotada: true };
}

export async function marcarVerificada(conversationId: string, email: string, hasta: Date): Promise<void> {
  await prisma.botConversation.update({
    where: { id: conversationId },
    data: { buyerEmail: normalizeEmail(email), verifiedUntil: hasta },
  });
}

export async function crearAccionPendienteComprador(p: {
  conversationId: string; toolName: string; input: unknown; summary: string;
}): Promise<{ actionId: string }> {
  const a = await prisma.botAction.create({
    data: {
      platform: BOT_PLATFORM, conversationId: p.conversationId, userId: null, toolName: p.toolName,
      input: p.input as object, summary: p.summary, expiresAt: new Date(Date.now() + ACTION_TTL_MS),
    },
    select: { id: true },
  });
  return { actionId: a.id };
}

function filtroAccionDelNavegador(actionId: string, guestKey: string) {
  return { id: actionId, userId: null, status: "PENDING" as const, conversation: { is: { guestKey, audience: "BUYER" as const } } };
}

/**
 * Conversación de una acción todavía pendiente de este navegador (sólo lectura, no la reclama).
 * La ruta de acciones la usa para cargar y validar la conversación ANTES de `tomar…`: así un 409
 * nunca deja una acción EXECUTED sin haber corrido.
 */
export async function conversacionDeAccionPendienteComprador(actionId: string, guestKey: string): Promise<string | null> {
  const r = await prisma.botAction.findFirst({
    where: { ...filtroAccionDelNavegador(actionId, guestKey), expiresAt: { gt: new Date() } },
    select: { conversationId: true },
  });
  return r?.conversationId ?? null;
}

/** PENDING → EXECUTED atómico; null si ya se decidió, venció o es de otro navegador (o doble clic). */
export async function tomarAccionPendienteComprador(actionId: string, guestKey: string): Promise<BotActionRow | null> {
  const now = new Date();
  const r = await prisma.botAction.updateMany({
    where: { ...filtroAccionDelNavegador(actionId, guestKey), expiresAt: { gt: now } },
    data: { status: "EXECUTED", decidedAt: now },
  });
  if (r.count !== 1) return null;
  return prisma.botAction.findUnique({ where: { id: actionId }, select: SELECT_ACCION });
}

export async function rechazarAccionPendienteComprador(actionId: string, guestKey: string): Promise<boolean> {
  const now = new Date();
  const r = await prisma.botAction.updateMany({
    where: { ...filtroAccionDelNavegador(actionId, guestKey), expiresAt: { gt: now } },
    data: { status: "REJECTED", decidedAt: now },
  });
  return r.count === 1;
}

/** sha256 hex del mail normalizado: para contar y medir sin guardar el mail en claro. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

/** Deja rastro de una acción sin tarjeta (límites y métricas). Nunca guarda el mail en claro. */
export async function registrarAccionComprador(p: {
  conversationId: string; toolName: string; email: string | null; resultado: string; datos?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  const resumen = p.resultado.slice(0, 300);
  await prisma.botAction.create({
    data: {
      platform: BOT_PLATFORM, conversationId: p.conversationId, userId: null, toolName: p.toolName,
      // emailHash va último: `datos` no puede pisarlo.
      input: { ...p.datos, emailHash: p.email ? hashEmail(p.email) : null } as object,
      summary: resumen, status: "EXECUTED", expiresAt: now, decidedAt: now, resultMessage: resumen,
    },
  });
}

export async function contarAccionesComprador(p: {
  toolName: string | string[]; desde: Date; email?: string; ipHash?: string;
}): Promise<number> {
  return prisma.botAction.count({
    where: {
      platform: BOT_PLATFORM,
      userId: null,
      toolName: Array.isArray(p.toolName) ? { in: p.toolName } : p.toolName,
      createdAt: { gte: p.desde },
      ...(p.email ? { input: { path: ["emailHash"], equals: hashEmail(p.email) } } : {}),
      ...(p.ipHash ? { conversation: { is: { ipHash: p.ipHash } } } : {}),
    },
  });
}

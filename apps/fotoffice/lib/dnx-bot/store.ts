import "server-only";
import { HARD_CAP_TURNS, carryOverMessage, countTurns, type TokenUsage } from "@repo/dnx-bot";
import { prisma } from "@repo/db";
import { PREFIJO_PLATAFORMA } from "./config";
import { diaArgentino, mesArgentino } from "./dia-argentino";
import type { UsoFotoffice } from "./limites";

/**
 * Persistencia de DNX Bot en FOTOFFICE sobre las tablas `Bot*` que ya existen (spec §7, sin
 * migración). Molde de `apps/compramelafoto/lib/bot/store.ts` con una diferencia de fondo: todo
 * va separado por `platform = "FOTOFFICE:<workspaceId>"`, y toda búsqueda filtra por esa plataforma
 * (una conversación o una acción nunca cruza de workspace). El gasto de todo FOTOFFICE es
 * `platform startsWith "FOTOFFICE:"`, que nunca incluye a CLF.
 */

const VENTANA_ABIERTA_MS = 6 * 60 * 60 * 1000;
const VIDA_ACCION_MS = 60 * 60 * 1000;

const TODO_FOTOFFICE = { startsWith: PREFIJO_PLATAFORMA };

export function claveUsuario(userId: number): string {
  return `u:${userId}`;
}

type PedidoConversacion = { plataforma: string; userId: number; pagePath: string | null; model: string };
export type ConversacionRef = { id: string; createdAt: Date };

async function crearConversacion(p: PedidoConversacion): Promise<ConversacionRef> {
  return prisma.botConversation.create({
    data: { platform: p.plataforma, audience: "PHOTOGRAPHER", userId: p.userId, pagePath: p.pagePath, model: p.model },
    select: { id: true, createdAt: true },
  });
}

/**
 * La conversación abierta (últimas 6 h) o una nueva. Ya NO se corta por cantidad de mensajes: el
 * 13/10 se abría otra a las 40 filas y el bot perdía todo el contexto en medio del perfil. Lo que
 * se manda al modelo lo acota la ventana (`windowHistory`), no la conversación.
 */
export async function conversacionAbierta(p: PedidoConversacion): Promise<ConversacionRef> {
  const abierta = await prisma.botConversation.findFirst({
    where: {
      platform: p.plataforma,
      audience: "PHOTOGRAPHER",
      userId: p.userId,
      status: "OPEN",
      updatedAt: { gt: new Date(Date.now() - VENTANA_ABIERTA_MS) },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdAt: true },
  });
  return abierta ?? crearConversacion(p);
}

/** Historial completo: los mensajes tal cual van a la API y, aparte, la fecha de cada uno. */
export async function cargarHistorial(conversationId: string): Promise<{ mensajes: unknown[]; fechas: Date[] }> {
  const filas = await prisma.botMessage.findMany({
    where: { conversationId },
    orderBy: { seq: "asc" },
    select: { role: true, content: true, createdAt: true },
  });
  return { mensajes: filas.map((f) => ({ role: f.role, content: f.content })), fechas: filas.map((f) => f.createdAt) };
}

/**
 * La conversación del turno con su historial. Sólo si pasó el tope duro (HARD_CAP_TURNS turnos de
 * la persona, no filas) se abre otra, que arranca con el resumen de la anterior: la persona no ve
 * un corte. `creada` sirve para saber qué parte del borrador ya está en el historial.
 */
export async function continuarConversacion(
  p: PedidoConversacion,
): Promise<{ id: string; creada: Date; mensajes: unknown[]; fechas: Date[]; rotada: boolean }> {
  const conv = await conversacionAbierta(p);
  const h = await cargarHistorial(conv.id);
  if (countTurns(h.mensajes) < HARD_CAP_TURNS) return { id: conv.id, creada: conv.createdAt, ...h, rotada: false };
  const nueva = await crearConversacion(p);
  await agregarMensajes(nueva.id, [carryOverMessage(h.mensajes)]);
  return { id: nueva.id, creada: nueva.createdAt, ...(await cargarHistorial(nueva.id)), rotada: true };
}

export async function agregarMensajes(conversationId: string, msgs: { role: string; content: unknown }[]): Promise<void> {
  if (msgs.length === 0) return;
  await prisma.$transaction(async (tx) => {
    // Bloquea la conversación: dos turnos simultáneos no pueden leer el mismo seq máximo.
    await tx.$queryRaw`SELECT id FROM "BotConversation" WHERE id = ${conversationId} FOR UPDATE`;
    const agg = await tx.botMessage.aggregate({ where: { conversationId }, _max: { seq: true } });
    const inicio = (agg._max.seq ?? -1) + 1;
    await tx.botMessage.createMany({
      data: msgs.map((m, i) => ({ conversationId, seq: inicio + i, role: m.role, content: m.content as object })),
    });
  });
}

export async function registrarUso(p: {
  plataforma: string;
  userId: number;
  conversationId: string;
  usage: TokenUsage;
  costMicroUsd: number;
  contarMensaje: boolean;
}): Promise<void> {
  const day = diaArgentino();
  const actorKey = claveUsuario(p.userId);
  const mensajes = p.contarMensaje ? 1 : 0;
  await prisma.botUsageDaily.upsert({
    where: { platform_day_actorKey: { platform: p.plataforma, day, actorKey } },
    create: {
      platform: p.plataforma,
      day,
      userId: p.userId,
      actorKey,
      messages: mensajes,
      inputTokens: p.usage.input_tokens,
      outputTokens: p.usage.output_tokens,
      costMicroUsd: p.costMicroUsd,
    },
    update: {
      messages: { increment: mensajes },
      inputTokens: { increment: p.usage.input_tokens },
      outputTokens: { increment: p.usage.output_tokens },
      costMicroUsd: { increment: p.costMicroUsd },
    },
  });
  await prisma.botConversation.update({
    where: { id: p.conversationId },
    data: {
      inputTokens: { increment: p.usage.input_tokens },
      outputTokens: { increment: p.usage.output_tokens },
      cacheReadTokens: { increment: p.usage.cache_read_input_tokens ?? 0 },
      costMicroUsd: { increment: p.costMicroUsd },
    },
  });
}

/** Mensajes de hoy de la persona (en todos sus workspaces), gasto del mes de todo FOTOFFICE y del workspace. */
export async function usoActual(p: { plataforma: string; userId: number; ahora?: Date }): Promise<UsoFotoffice> {
  const ahora = p.ahora ?? new Date();
  const [hoy, global, workspace] = await Promise.all([
    prisma.botUsageDaily.aggregate({
      where: { platform: TODO_FOTOFFICE, day: diaArgentino(ahora), actorKey: claveUsuario(p.userId) },
      _sum: { messages: true },
    }),
    gastoDelMes({ ahora }),
    gastoDelMes({ plataforma: p.plataforma, ahora }),
  ]);
  return { mensajesHoyPersona: hoy._sum.messages ?? 0, gastoMesGlobal: global, gastoMesWorkspace: workspace };
}

/** Gasto del mes argentino en micro-USD: de un workspace, o de todo FOTOFFICE si no se pasa plataforma. */
export async function gastoDelMes(p: { plataforma?: string; ahora?: Date }): Promise<number> {
  const r = await prisma.botUsageDaily.aggregate({
    where: { platform: p.plataforma ?? TODO_FOTOFFICE, day: { startsWith: mesArgentino(p.ahora ?? new Date()) } },
    _sum: { costMicroUsd: true },
  });
  return r._sum.costMicroUsd ?? 0;
}

export async function crearAccionPendiente(p: {
  plataforma: string;
  conversationId: string;
  userId: number;
  toolName: string;
  input: unknown;
  summary: string;
}): Promise<{ actionId: string }> {
  const a = await prisma.botAction.create({
    data: {
      platform: p.plataforma,
      conversationId: p.conversationId,
      userId: p.userId,
      toolName: p.toolName,
      input: p.input as object,
      summary: p.summary,
      expiresAt: new Date(Date.now() + VIDA_ACCION_MS),
    },
    select: { id: true },
  });
  return { actionId: a.id };
}

export type FilaAccion = { id: string; toolName: string; input: unknown; summary: string; conversationId: string | null };

type RefAccion = { id: string; plataforma: string; userId: number };

/** PENDING → tomada, atómico. null si ya se decidió, venció, es de otra persona o de otro workspace. */
export async function tomarAccionPendiente(p: RefAccion): Promise<FilaAccion | null> {
  const r = await prisma.botAction.updateMany({
    where: { id: p.id, userId: p.userId, platform: p.plataforma, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "EXECUTED", decidedAt: new Date() },
  });
  if (r.count !== 1) return null;
  return prisma.botAction.findUnique({
    where: { id: p.id },
    select: { id: true, toolName: true, input: true, summary: true, conversationId: true },
  });
}

export async function rechazarAccionPendiente(p: RefAccion): Promise<boolean> {
  const r = await prisma.botAction.updateMany({
    where: { id: p.id, userId: p.userId, platform: p.plataforma, status: "PENDING" },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  return r.count === 1;
}

export async function terminarAccion(
  id: string,
  r: { status: "EXECUTED" | "FAILED" | "UNDONE"; before?: unknown; after?: unknown; resultMessage: string },
): Promise<void> {
  await prisma.botAction.update({
    where: { id },
    data: {
      status: r.status,
      resultMessage: r.resultMessage,
      ...(r.before !== undefined ? { before: r.before as object } : {}),
      ...(r.after !== undefined ? { after: r.after as object } : {}),
    },
  });
}

/** Una acción ejecutada de esa persona en ese workspace (ajena o de otro workspace = inexistente). */
export async function accionParaDeshacer(p: RefAccion) {
  return prisma.botAction.findFirst({
    where: { id: p.id, userId: p.userId, platform: p.plataforma, status: "EXECUTED" },
    select: { id: true, toolName: true, before: true, decidedAt: true, conversationId: true },
  });
}

/** EXECUTED → UNDONE, atómico: sólo un "deshacer" pasa. */
export async function marcarDeshecha(id: string): Promise<boolean> {
  const r = await prisma.botAction.updateMany({ where: { id, status: "EXECUTED" }, data: { status: "UNDONE" } });
  return r.count === 1;
}

/** Si el deshacer falló, vuelve a EXECUTED para poder reintentar dentro de la ventana. */
export async function volverAEjecutada(id: string): Promise<void> {
  await prisma.botAction.updateMany({ where: { id, status: "UNDONE" }, data: { status: "EXECUTED" } });
}

export async function registrarIncidente(p: {
  plataforma: string;
  signature: string;
  title: string;
  data: unknown;
  urgent: boolean;
}): Promise<{ occurrences: number; isNew: boolean }> {
  const where = { platform_signature: { platform: p.plataforma, signature: p.signature } };
  const existente = await prisma.botIncident.findUnique({ where, select: { id: true } });
  const fila = await prisma.botIncident.upsert({
    where,
    create: { platform: p.plataforma, signature: p.signature, title: p.title, data: p.data as object, urgent: p.urgent },
    update: { occurrences: { increment: 1 }, lastSeenAt: new Date(), data: p.data as object, ...(p.urgent ? { urgent: true } : {}) },
    select: { occurrences: true },
  });
  return { occurrences: fila.occurrences, isNew: !existente };
}

/**
 * Reserva una marca única (BotIncident con esa firma): true sólo para quien la crea. El índice
 * único (platform, signature) lo hace atómico entre instancias. Nace IGNORED: no es un error.
 */
export async function reservarMarca(p: { plataforma: string; signature: string; title: string; data: unknown }): Promise<boolean> {
  try {
    await prisma.botIncident.create({
      data: { platform: p.plataforma, signature: p.signature, title: p.title, data: p.data as object, status: "IGNORED" },
      select: { id: true },
    });
    return true;
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return false;
    throw e;
  }
}

/** Libera la marca (p. ej. si el aviso no salió) para que otro turno lo reintente. */
export async function liberarMarca(p: { plataforma: string; signature: string }): Promise<void> {
  await prisma.botIncident.deleteMany({ where: { platform: p.plataforma, signature: p.signature } });
}

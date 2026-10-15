import { HARD_CAP_TURNS, carryOverMessage, countTurns, type BotUsageSnapshot, type TokenUsage } from "@repo/dnx-bot";
import { prisma } from "@/lib/prisma";
import { claveUsuario } from "./actor-key";
import { BOT_PLATFORM } from "./config";
import { argentinaDay, argentinaMonthPrefix } from "./dia-argentino";

const OPEN_WINDOW_MS = 6 * 60 * 60 * 1000;
const ACTION_TTL_MS = 60 * 60 * 1000;

export type ConversationRef = { id: string; status: "OPEN" | "ESCALATED" | "CLOSED"; supportTicketId: number | null };

export async function getOrCreateConversation(p: { userId: number; pagePath: string | null; model: string }): Promise<ConversationRef> {
  // ESCALATED sigue siendo continuable: después de abrir un ticket, el próximo mensaje conserva el contexto.
  const open = await prisma.botConversation.findFirst({
    where: {
      platform: BOT_PLATFORM,
      audience: "PHOTOGRAPHER",
      userId: p.userId,
      status: { in: ["OPEN", "ESCALATED"] },
      updatedAt: { gt: new Date(Date.now() - OPEN_WINDOW_MS) },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, supportTicketId: true },
  });
  // Ya no se corta por cantidad de mensajes (el bot perdía el contexto a mitad de una charla): lo
  // que viaja al modelo lo acota la ventana del historial (`windowHistory`) en la ruta del chat.
  if (open) return { id: open.id, status: open.status, supportTicketId: open.supportTicketId };
  const created = await prisma.botConversation.create({
    data: { platform: BOT_PLATFORM, userId: p.userId, pagePath: p.pagePath, model: p.model },
    select: { id: true, status: true, supportTicketId: true },
  });
  return { id: created.id, status: created.status, supportTicketId: created.supportTicketId };
}

export async function loadHistory(conversationId: string): Promise<unknown[]> {
  const rows = await prisma.botMessage.findMany({ where: { conversationId }, orderBy: { seq: "asc" }, select: { role: true, content: true } });
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

/**
 * El historial del turno. Sólo si la conversación pasó el tope duro (HARD_CAP_TURNS turnos de la
 * persona, no filas) se abre otra —con el mismo estado y ticket— que arranca con el resumen de la
 * anterior: para la persona no hay corte.
 */
export async function continueConversation(
  conv: ConversationRef,
  p: { userId: number; pagePath: string | null; model: string },
): Promise<{ conv: ConversationRef; history: unknown[]; rotated: boolean }> {
  const history = await loadHistory(conv.id);
  if (countTurns(history) < HARD_CAP_TURNS) return { conv, history, rotated: false };
  const created = await prisma.botConversation.create({
    data: {
      platform: BOT_PLATFORM, userId: p.userId, pagePath: p.pagePath, model: p.model,
      status: conv.status, supportTicketId: conv.supportTicketId,
    },
    select: { id: true, status: true, supportTicketId: true },
  });
  const carry = carryOverMessage(history);
  await appendMessages(created.id, [carry]);
  return { conv: { id: created.id, status: created.status, supportTicketId: created.supportTicketId }, history: [carry], rotated: true };
}

export async function appendMessages(conversationId: string, msgs: { role: string; content: unknown }[]) {
  if (msgs.length === 0) return;
  await prisma.$transaction(async (tx) => {
    // Bloquea la conversación: dos turnos simultáneos no pueden leer el mismo seq máximo.
    await tx.$queryRaw`SELECT id FROM "BotConversation" WHERE id = ${conversationId} FOR UPDATE`;
    const agg = await tx.botMessage.aggregate({ where: { conversationId }, _max: { seq: true } });
    const start = (agg._max.seq ?? -1) + 1;
    await tx.botMessage.createMany({
      data: msgs.map((m, i) => ({ conversationId, seq: start + i, role: m.role, content: m.content as object })),
    });
  });
}

export async function recordUsage(p: {
  userId: number; conversationId: string; usage: TokenUsage; costMicroUsd: number; countMessage: boolean;
}) {
  const day = argentinaDay();
  const actorKey = claveUsuario(p.userId);
  await prisma.botUsageDaily.upsert({
    where: { platform_day_actorKey: { platform: BOT_PLATFORM, day, actorKey } },
    create: {
      platform: BOT_PLATFORM, day, userId: p.userId, actorKey, messages: p.countMessage ? 1 : 0,
      inputTokens: p.usage.input_tokens, outputTokens: p.usage.output_tokens, costMicroUsd: p.costMicroUsd,
    },
    update: {
      messages: { increment: p.countMessage ? 1 : 0 },
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

export async function usageSnapshot(userId: number): Promise<BotUsageSnapshot> {
  const [today, month] = await Promise.all([
    prisma.botUsageDaily.findUnique({
      where: { platform_day_actorKey: { platform: BOT_PLATFORM, day: argentinaDay(), actorKey: claveUsuario(userId) } },
      select: { messages: true },
    }),
    prisma.botUsageDaily.aggregate({
      where: { platform: BOT_PLATFORM, day: { startsWith: argentinaMonthPrefix() } },
      _sum: { costMicroUsd: true },
    }),
  ]);
  return { userMessagesToday: today?.messages ?? 0, monthMicroUsd: month._sum.costMicroUsd ?? 0 };
}

export async function createPendingAction(p: {
  conversationId: string; userId: number; toolName: string; input: unknown; summary: string;
}) {
  const a = await prisma.botAction.create({
    data: {
      platform: BOT_PLATFORM, conversationId: p.conversationId, userId: p.userId, toolName: p.toolName,
      input: p.input as object, summary: p.summary, expiresAt: new Date(Date.now() + ACTION_TTL_MS),
    },
    select: { id: true },
  });
  return { actionId: a.id };
}

export type BotActionRow = { id: string; userId: number | null; toolName: string; input: unknown; summary: string; conversationId: string | null };

/** Pasa PENDING → (en curso) de forma atómica. Devuelve null si ya se decidió, venció o no es del usuario. */
export async function claimPendingAction(actionId: string, userId: number): Promise<BotActionRow | null> {
  const r = await prisma.botAction.updateMany({
    where: { id: actionId, userId, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "EXECUTED", decidedAt: new Date() },
  });
  if (r.count !== 1) return null;
  return prisma.botAction.findUnique({
    where: { id: actionId },
    select: { id: true, userId: true, toolName: true, input: true, summary: true, conversationId: true },
  });
}

export async function rejectPendingAction(actionId: string, userId: number): Promise<boolean> {
  const r = await prisma.botAction.updateMany({
    where: { id: actionId, userId, status: "PENDING" },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  return r.count === 1;
}

export async function finishAction(
  actionId: string,
  r: { status: "EXECUTED" | "FAILED" | "UNDONE"; before?: unknown; after?: unknown; resultMessage: string },
) {
  await prisma.botAction.update({
    where: { id: actionId },
    data: {
      status: r.status,
      resultMessage: r.resultMessage,
      ...(r.before !== undefined ? { before: r.before as object } : {}),
      ...(r.after !== undefined ? { after: r.after as object } : {}),
    },
  });
}

export async function upsertIncident(p: { signature: string; title: string; data: unknown; urgent: boolean }) {
  const existing = await prisma.botIncident.findUnique({
    where: { platform_signature: { platform: BOT_PLATFORM, signature: p.signature } },
    select: { id: true },
  });
  const row = await prisma.botIncident.upsert({
    where: { platform_signature: { platform: BOT_PLATFORM, signature: p.signature } },
    create: { platform: BOT_PLATFORM, signature: p.signature, title: p.title, data: p.data as object, urgent: p.urgent },
    update: { occurrences: { increment: 1 }, lastSeenAt: new Date(), data: p.data as object, ...(p.urgent ? { urgent: true } : {}) },
    select: { id: true, occurrences: true },
  });
  return { id: row.id, occurrences: row.occurrences, isNew: !existing };
}

/** Suma del gasto del mes argentino (todas las personas). */
export async function monthCostMicroUsd(now: Date = new Date()): Promise<number> {
  const r = await prisma.botUsageDaily.aggregate({
    where: { platform: BOT_PLATFORM, day: { startsWith: argentinaMonthPrefix(now) } },
    _sum: { costMicroUsd: true },
  });
  return r._sum.costMicroUsd ?? 0;
}

/**
 * Reserva una marca única (BotIncident con esa firma) y devuelve true sólo a quien la creó.
 * El índice único (platform, signature) lo hace atómico entre instancias: la segunda creación
 * choca con P2002 y devuelve false. Nace IGNORED para no figurar como error en el resumen.
 */
export async function claimOnceMarker(p: { signature: string; title: string; data: unknown }): Promise<boolean> {
  try {
    await prisma.botIncident.create({
      data: { platform: BOT_PLATFORM, signature: p.signature, title: p.title, data: p.data as object, status: "IGNORED" },
      select: { id: true },
    });
    return true;
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return false;
    throw e;
  }
}

/** Libera la marca para que otro turno vuelva a intentar (p. ej. si el aviso no salió). */
export async function releaseOnceMarker(signature: string): Promise<void> {
  await prisma.botIncident.deleteMany({ where: { platform: BOT_PLATFORM, signature } });
}

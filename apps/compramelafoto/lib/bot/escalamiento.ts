import { incidentSignature, sendTelegramMessage, type BotActor } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";
import { loadHistory, upsertIncident } from "@/lib/bot/store";
import { prisma } from "@/lib/prisma";
import { createSupportTicket } from "@/lib/support/create-ticket";
import { SUPPORT_MESSAGE_MAX_LENGTH, type ALLOWED_REASONS } from "@/lib/support/sanitize";

type Reason = (typeof ALLOWED_REASONS)[number];

export const NOTE_HEADER = "Derivado por DNX Bot.\n\n";

/** Recorta por el principio: lo más reciente de la charla es lo que más importa para soporte. */
export function keepTail(text: string, max: number): string {
  if (text.length <= max) return text;
  return `…${text.slice(text.length - (max - 1))}`;
}

export function transcript(history: unknown[]): string {
  return (history as { role: string; content: unknown }[])
    .map((m) => {
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? (m.content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join(" ")
            : "";
      return text ? `${m.role === "user" ? "Usuario" : "DNX Bot"}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function escalateToHuman(p: {
  actor: BotActor;
  conversationId: string;
  motivo: Reason;
  resumen: string;
  urgente: boolean;
  /** Texto del turno en curso (todavía no está guardado en el historial cuando lo pide la herramienta). */
  currentUserText?: string;
}): Promise<{ ticketId: number; reused: boolean }> {
  // Un ticket por conversación: si ya se derivó, se devuelve el mismo en vez de abrir otro.
  const conv = await prisma.botConversation.findUnique({
    where: { id: p.conversationId },
    select: { status: true, supportTicketId: true },
  });
  if (conv?.status === "ESCALATED" && conv.supportTicketId != null) {
    return { ticketId: conv.supportTicketId, reused: true };
  }

  const history = await loadHistory(p.conversationId);
  const turn = p.currentUserText?.trim() ? [{ role: "user", content: p.currentUserText.trim() }] : [];
  const charla = keepTail(transcript([...history, ...turn]), SUPPORT_MESSAGE_MAX_LENGTH - NOTE_HEADER.length);
  const ticket = await createSupportTicket({
    data: {
      reason: p.motivo,
      description: p.resumen.slice(0, 8000),
      printOrderId: null,
      requesterName: p.actor.name,
      requesterEmail: p.actor.email.toLowerCase(),
      requesterPhone: null,
      requesterRole: p.actor.role,
    },
    requesterLabel: `${p.actor.name || p.actor.email} · ${p.actor.email}`,
    internalNote: `${NOTE_HEADER}${charla}`,
    adminTitle: p.urgente ? "URGENTE · DNX Bot derivó un caso" : "DNX Bot derivó un caso",
  });
  await prisma.botConversation.update({
    where: { id: p.conversationId },
    data: { status: "ESCALATED", supportTicketId: ticket.id },
  });
  if (p.urgente) {
    await sendTelegramMessage(
      readBotConfig().telegram,
      `🚨 CLF · Ticket #${ticket.id} (${p.motivo})\n${p.actor.name ?? ""} ${p.actor.email}\n\n${p.resumen}`,
    );
  }
  return { ticketId: ticket.id, reused: false };
}

/** Tope de avisos urgentes por Telegram por proceso: pasado el tope, el incidente queda sólo en la base. */
export const MAX_INCIDENT_ALERTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
let alertTimes: number[] = [];

function takeAlertSlot(now = Date.now()): boolean {
  alertTimes = alertTimes.filter((t) => now - t < HOUR_MS);
  if (alertTimes.length >= MAX_INCIDENT_ALERTS_PER_HOUR) return false;
  alertTimes.push(now);
  return true;
}

/** Sólo para tests. */
export function resetIncidentAlertBudget() {
  alertTimes = [];
}

export async function reportIncident(p: {
  area: string;
  codigo: string;
  ids: Record<string, string | number>;
  detalle: string;
  urgente: boolean;
}): Promise<void> {
  const signature = incidentSignature({ area: p.area, codigo: p.codigo });
  const r = await upsertIncident({
    signature,
    title: `${p.area}: ${p.codigo}`,
    data: { ids: p.ids, detalle: p.detalle.slice(0, 500) },
    urgent: p.urgente,
  });
  if (p.urgente && r.isNew && takeAlertSlot()) {
    await sendTelegramMessage(
      readBotConfig().telegram,
      `🐞 CLF · Error nuevo en ${p.area}: ${p.codigo}\n${p.detalle.slice(0, 300)}`,
    );
  }
}

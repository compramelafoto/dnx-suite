import { incidentSignature, sendTelegramMessage, type BotActor } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";
import { loadHistory, upsertIncident } from "@/lib/bot/store";
import { prisma } from "@/lib/prisma";
import { createSupportTicket } from "@/lib/support/create-ticket";
import type { ALLOWED_REASONS } from "@/lib/support/sanitize";

type Reason = (typeof ALLOWED_REASONS)[number];

function transcript(history: unknown[]): string {
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
}): Promise<{ ticketId: number }> {
  const history = await loadHistory(p.conversationId);
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
    internalNote: `Derivado por DNX Bot.\n\n${transcript(history)}`,
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
  return { ticketId: ticket.id };
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
  if (p.urgente && r.isNew) {
    await sendTelegramMessage(
      readBotConfig().telegram,
      `🐞 CLF · Error nuevo en ${p.area}: ${p.codigo}\n${p.detalle.slice(0, 300)}`,
    );
  }
}

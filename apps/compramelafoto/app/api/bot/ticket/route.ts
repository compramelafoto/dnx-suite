import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser, readBotConfig } from "@/lib/bot/config";
import { escalateToHuman } from "@/lib/bot/escalamiento";
import { getOrCreateConversation } from "@/lib/bot/store";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKETS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  if (!(await isBotEnabledForUser(user.id))) return Response.json({ error: "No encontrado" }, { status: 404 });
  const { resumen } = ((await req.json().catch(() => ({}))) ?? {}) as { resumen?: unknown };
  const conv = await getOrCreateConversation({ userId: user.id, pagePath: null, model: readBotConfig().model });
  // La conversación ya está derivada: el mismo ticket, sin abrir otro por cada clic.
  if (conv.status === "ESCALATED" && conv.supportTicketId != null) {
    return Response.json({ ticketId: conv.supportTicketId, reused: true });
  }
  const limit = checkRateLimit({ key: `bot-ticket:${user.id}`, limit: TICKETS_PER_HOUR, windowMs: HOUR_MS });
  if (!limit.allowed) {
    return Response.json(
      { error: "Ya abriste varios pedidos de soporte en la última hora. Te vamos a responder por ahí; si es urgente, escribinos desde Soporte." },
      { status: 429 },
    );
  }
  const r = await escalateToHuman({
    actor: { userId: user.id, role: String(user.role), email: user.email, name: user.name },
    conversationId: conv.id,
    motivo: "OTHER",
    resumen:
      (typeof resumen === "string" && resumen.trim().slice(0, 1500)) ||
      "La persona pidió hablar con alguien del equipo desde DNX Bot.",
    urgente: false,
  });
  return Response.json({ ticketId: r.ticketId, reused: r.reused });
}

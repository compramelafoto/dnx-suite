import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser, readBotConfig } from "@/lib/bot/config";
import { escalateToHuman } from "@/lib/bot/escalamiento";
import { getOrCreateConversation } from "@/lib/bot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  if (!(await isBotEnabledForUser(user.id))) return Response.json({ error: "No encontrado" }, { status: 404 });
  const { resumen } = ((await req.json().catch(() => ({}))) ?? {}) as { resumen?: unknown };
  const conv = await getOrCreateConversation({ userId: user.id, pagePath: null, model: readBotConfig().model });
  const r = await escalateToHuman({
    actor: { userId: user.id, role: String(user.role), email: user.email, name: user.name },
    conversationId: conv.id,
    motivo: "OTHER",
    resumen:
      (typeof resumen === "string" && resumen.trim().slice(0, 1500)) ||
      "La persona pidió hablar con alguien del equipo desde DNX Bot.",
    urgente: false,
  });
  return Response.json(r);
}

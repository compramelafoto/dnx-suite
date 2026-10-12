import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser } from "@/lib/bot/config";
import { CAMPANIAS, registrarOutreach, type Campania } from "@/lib/bot/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCIONES = ["CLICKED", "DISMISSED", "DECLINED"] as const;
type Accion = (typeof ACCIONES)[number];

/** Registra qué hizo la persona con el globito (una fila por campaña: repetir la llamada no duplica). */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  if (!(await isBotEnabledForUser(user.id))) return Response.json({ error: "No encontrado" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { campaign?: unknown; accion?: unknown; answer?: unknown } | null;
  const campaign = body?.campaign;
  const accion = body?.accion;
  if (typeof campaign !== "string" || !(CAMPANIAS as readonly string[]).includes(campaign)) {
    return Response.json({ error: "Campaña inválida" }, { status: 400 });
  }
  if (typeof accion !== "string" || !(ACCIONES as readonly string[]).includes(accion)) {
    return Response.json({ error: "Acción inválida" }, { status: 400 });
  }
  const answer = typeof body?.answer === "string" && body.answer.trim() ? body.answer.trim().slice(0, 500) : undefined;
  await registrarOutreach({ userId: user.id, campaign: campaign as Campania, channel: "PANEL", status: accion as Accion, answer });
  return Response.json({ ok: true });
}

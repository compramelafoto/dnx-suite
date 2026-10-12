import type { BotActor, ToolOutcome } from "@repo/dnx-bot";
import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser } from "@/lib/bot/config";
import { toolsForActor } from "@/lib/bot/herramientas";
import { appendMessages, claimPendingAction, finishAction, rejectPendingAction } from "@/lib/bot/store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNDO_WINDOW_MS = 10 * 60 * 1000;

async function undoAction(id: string, actor: BotActor) {
  // Filtra por dueño: una acción ajena es indistinguible de una inexistente.
  const a = await prisma.botAction.findFirst({
    where: { id, userId: actor.userId, status: "EXECUTED" },
    select: { id: true, toolName: true, before: true, decidedAt: true, conversationId: true },
  });
  if (!a || !a.decidedAt || Date.now() - a.decidedAt.getTime() > UNDO_WINDOW_MS) {
    return Response.json({ ok: false, message: "Ya no se puede deshacer." }, { status: 409 });
  }
  const tool = toolsForActor(actor, { conversationId: a.conversationId ?? "" }).find(
    (t) => t.name === a.toolName && t.kind === "write",
  );
  if (!tool?.undo || a.before == null) {
    return Response.json({ ok: false, message: "Esta acción no se puede deshacer." }, { status: 409 });
  }
  const claimed = await prisma.botAction.updateMany({ where: { id: a.id, status: "EXECUTED" }, data: { status: "UNDONE" } });
  if (claimed.count !== 1) return Response.json({ ok: false, message: "Ya se deshizo." }, { status: 409 });

  let r: ToolOutcome;
  try {
    r = await tool.undo(a.before, actor);
  } catch (e) {
    console.error("[dnx-bot] deshacer", a.toolName, e);
    r = { ok: false, message: "No pude deshacerlo." };
  }
  if (!r.ok) {
    // Vuelve a EXECUTED para que se pueda reintentar dentro de la ventana.
    await prisma.botAction.updateMany({ where: { id: a.id, status: "UNDONE" }, data: { status: "EXECUTED" } });
  }
  if (a.conversationId) {
    await appendMessages(a.conversationId, [
      {
        role: "user",
        content: `[Sistema] El usuario ${r.ok ? "deshizo" : "intentó deshacer sin éxito"} la acción ${a.id}. Resultado: ${r.message}`,
      },
    ]);
  }
  return Response.json({ ok: r.ok, message: r.message });
}

// La escritura la corre el servidor, nunca el modelo: sólo tras la decisión explícita de la persona.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return Response.json({ ok: false, message: "No autenticado" }, { status: 401 });
  if (!(await isBotEnabledForUser(user.id))) return Response.json({ ok: false, message: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { decision } = ((await req.json().catch(() => ({}))) ?? {}) as { decision?: unknown };
  const actor: BotActor = { userId: user.id, role: String(user.role), email: user.email, name: user.name };

  if (decision === "rechazar") {
    const ok = await rejectPendingAction(id, user.id);
    return Response.json(
      { ok, message: ok ? "Listo, no hago nada." : "Esa propuesta ya no está pendiente." },
      { status: ok ? 200 : 409 },
    );
  }
  if (decision === "deshacer") return undoAction(id, actor);
  if (decision !== "confirmar") return Response.json({ ok: false, message: "Decisión inválida" }, { status: 400 });

  // Atómico: sólo una confirmación pasa (doble clic, vencida, ajena o ya decidida → null).
  const action = await claimPendingAction(id, user.id);
  if (!action) {
    return Response.json(
      { ok: false, message: "Esa propuesta ya no está pendiente (se usó, venció o no es tuya)." },
      { status: 409 },
    );
  }
  const tool = toolsForActor(actor, { conversationId: action.conversationId ?? "" }).find(
    (t) => t.name === action.toolName && t.kind === "write",
  );
  const parsed = tool?.input.safeParse(action.input);
  if (!tool || !parsed?.success) {
    await finishAction(id, { status: "FAILED", resultMessage: "Herramienta o datos inválidos" });
    return Response.json({ ok: false, message: "No pude hacerlo." }, { status: 400 });
  }

  let out: ToolOutcome;
  try {
    out = await tool.run(parsed.data, actor);
  } catch (e) {
    console.error("[dnx-bot] acción", action.toolName, e);
    out = { ok: false, message: "Falló al aplicar el cambio." };
  }
  await finishAction(
    id,
    out.ok
      ? { status: "EXECUTED", before: out.before, after: out.after, resultMessage: out.message }
      : { status: "FAILED", resultMessage: out.message },
  );
  if (action.conversationId) {
    await appendMessages(action.conversationId, [
      {
        role: "user",
        content: `[Sistema] El usuario ${out.ok ? "confirmó" : "confirmó pero falló"} la acción ${id} («${action.summary}»). Resultado: ${out.message}`,
      },
    ]);
  }
  return Response.json({ ok: out.ok, message: out.message, canUndo: out.ok && !!tool.undo });
}

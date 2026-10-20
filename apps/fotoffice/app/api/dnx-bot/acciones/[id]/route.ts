import type { BotActor, ToolOutcome } from "@repo/dnx-bot";
import { resolverBot, type CtxBot } from "@/lib/dnx-bot/acceso";
import { herramientasPara } from "@/lib/dnx-bot/herramientas";
import {
  accionParaDeshacer,
  agregarMensajes,
  marcarDeshecha,
  rechazarAccionPendiente,
  terminarAccion,
  tomarAccionPendiente,
  volverAEjecutada,
} from "@/lib/dnx-bot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VENTANA_DESHACER_MS = 10 * 60 * 1000;

function herramienta(ctx: CtxBot, nombre: string) {
  // Las herramientas se arman con los permisos de AHORA: si se los sacaron, no está.
  return herramientasPara(ctx).find((t) => t.name === nombre && t.kind === "write");
}

async function deshacer(ctx: CtxBot, actor: BotActor, id: string) {
  const a = await accionParaDeshacer({ id, plataforma: ctx.plataforma, userId: actor.userId });
  if (!a || !a.decidedAt || Date.now() - a.decidedAt.getTime() > VENTANA_DESHACER_MS) {
    return Response.json({ ok: false, message: "Ya no se puede deshacer." }, { status: 409 });
  }
  const tool = herramienta(ctx, a.toolName);
  if (!tool?.undo || a.before == null) {
    return Response.json({ ok: false, message: "Esta acción no se puede deshacer." }, { status: 409 });
  }
  if (!(await marcarDeshecha(a.id))) return Response.json({ ok: false, message: "Ya se deshizo." }, { status: 409 });

  let r: ToolOutcome;
  try {
    r = await tool.undo(a.before, actor);
  } catch (e) {
    console.error("[dnx-bot] deshacer", a.toolName, e);
    r = { ok: false, message: "No pude deshacerlo." };
  }
  if (!r.ok) await volverAEjecutada(a.id);
  if (a.conversationId) {
    await agregarMensajes(a.conversationId, [
      { role: "user", content: `[Sistema] El usuario ${r.ok ? "deshizo" : "intentó deshacer sin éxito"} la acción ${a.id}. Resultado: ${r.message}` },
    ]);
  }
  return Response.json({ ok: r.ok, message: r.message, canUndo: !r.ok });
}

/**
 * Confirmar, rechazar o deshacer una propuesta de DNX Bot. La escritura la corre el servidor, nunca
 * el modelo, y sólo tras la decisión explícita de la persona. Las puertas se revalidan (spec §8) y
 * la acción se busca con la plataforma del workspace activo: una de otro workspace no existe.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const puertas = await resolverBot();
  if (!puertas.ok) return Response.json({ ok: false, message: "No encontrado" }, { status: 404 });
  const bot = puertas.ctx;
  const { id } = await ctx.params;
  const { decision } = ((await req.json().catch(() => ({}))) ?? {}) as { decision?: unknown };
  const actor: BotActor = { userId: bot.userId!, role: bot.role ?? "", email: bot.email, name: bot.nombre };
  const ref = { id, plataforma: bot.plataforma, userId: actor.userId };

  if (decision === "rechazar") {
    const ok = await rechazarAccionPendiente(ref);
    return Response.json({ ok, message: ok ? "Listo, no hago nada." : "Esa propuesta ya no está pendiente." }, { status: ok ? 200 : 409 });
  }
  if (decision === "deshacer") return deshacer(bot, actor, id);
  if (decision !== "confirmar") return Response.json({ ok: false, message: "Decisión inválida" }, { status: 400 });

  // Atómico: sólo una confirmación pasa (doble clic, vencida, ajena o ya decidida → null).
  const accion = await tomarAccionPendiente(ref);
  if (!accion) {
    return Response.json({ ok: false, message: "Esa propuesta ya no está pendiente (se usó, venció o no es tuya)." }, { status: 409 });
  }
  const tool = herramienta(bot, accion.toolName);
  const parsed = tool?.input.safeParse(accion.input);
  if (!tool || !parsed?.success) {
    await terminarAccion(id, { status: "FAILED", resultMessage: "Herramienta o datos inválidos" });
    return Response.json({ ok: false, message: "No pude hacerlo." }, { status: 400 });
  }

  let out: ToolOutcome;
  try {
    out = await tool.run(parsed.data, actor);
  } catch (e) {
    console.error("[dnx-bot] acción", accion.toolName, e);
    out = { ok: false, message: "Falló al aplicar el cambio." };
  }
  await terminarAccion(
    id,
    out.ok ? { status: "EXECUTED", before: out.before, after: out.after, resultMessage: out.message } : { status: "FAILED", resultMessage: out.message },
  );
  if (accion.conversationId) {
    await agregarMensajes(accion.conversationId, [
      {
        role: "user",
        content: `[Sistema] El usuario ${out.ok ? "confirmó" : "confirmó pero falló"} la acción ${id} («${accion.summary}»). Resultado: ${out.message}`,
      },
    ]);
  }
  return Response.json({ ok: out.ok, message: out.message, canUndo: out.ok && !!tool.undo && out.before !== undefined });
}

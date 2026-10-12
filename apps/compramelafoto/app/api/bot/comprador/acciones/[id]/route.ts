import type { ToolOutcome } from "@repo/dnx-bot";
import { readBuyerBotConfig } from "@/lib/bot/comprador/config";
import { actorDesdeConversacion, conversacionHabilitada } from "@/lib/bot/comprador/contexto-pedido";
import { herramientasComprador } from "@/lib/bot/comprador/herramientas";
import { AvisoAlComprador } from "@/lib/bot/comprador/herramientas/acciones";
import { ACTOR_MOTOR_COMPRADOR, ipDe, leerGuestKey, sesionVerificada } from "@/lib/bot/comprador/identidad";
import {
  conversacionDeAccionPendienteComprador,
  leerConversacionComprador,
  rechazarAccionPendienteComprador,
  tomarAccionPendienteComprador,
} from "@/lib/bot/comprador/store";
import { appendMessages, finishAction } from "@/lib/bot/store";
import { hashIp } from "@/lib/hidden-album-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_PENDIENTE = "Esa propuesta ya no está pendiente (se usó, venció o es de otra conversación).";
/** La herramienta lanza un error pensado para el modelo; a la persona le llega esto. */
const FALLA_AMABLE = "No pude hacerlo por un problema interno. Probá de nuevo en un rato o tocá «Hablar con una persona».";

const json = (body: { ok: boolean; message: string; canUndo?: boolean }, status = 200) =>
  Response.json({ canUndo: false, ...body }, { status });

// La escritura la corre el servidor, nunca el modelo: sólo tras la decisión explícita de la persona.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!readBuyerBotConfig().enabled) return json({ ok: false, message: "No encontrado" }, 404);
  const guestKey = leerGuestKey(req.headers.get("cookie"));
  if (!guestKey) return json({ ok: false, message: "No encontré tu conversación. Recargá la página y probá de nuevo." }, 401);
  const { id } = await ctx.params;
  const { decision } = ((await req.json().catch(() => ({}))) ?? {}) as { decision?: unknown };
  // Las dos tarjetas de compradores mandan solicitudes: no hay nada que deshacer.
  if (decision === "deshacer") return json({ ok: false, message: "Esta acción no se puede deshacer." }, 409);
  if (decision !== "confirmar" && decision !== "rechazar") return json({ ok: false, message: "Decisión inválida" }, 400);

  // Primero se valida la conversación (sólo lectura) y DESPUÉS se reclama la acción:
  // un 409 o un 404 nunca deja una acción EXECUTED sin haber corrido. Otro navegador → null.
  const conversationId = await conversacionDeAccionPendienteComprador(id, guestKey);
  const conv = conversationId ? await leerConversacionComprador(conversationId, guestKey) : null;
  if (!conv) return json({ ok: false, message: NO_PENDIENTE }, 409);
  if (!(await conversacionHabilitada(conv.albumId))) return json({ ok: false, message: "No encontrado" }, 404);

  if (decision === "rechazar") {
    const ok = await rechazarAccionPendienteComprador(id, guestKey);
    return json({ ok, message: ok ? "Listo, no hago nada." : "Esa propuesta ya no está pendiente." }, ok ? 200 : 409);
  }

  // Atómico: sólo una confirmación pasa (doble clic, vencida, ajena o ya decidida → null).
  const action = await tomarAccionPendienteComprador(id, guestKey);
  if (!action) return json({ ok: false, message: NO_PENDIENTE }, 409);
  if (action.conversationId !== conv.id) {
    // No debería pasar (la conversación de una acción no cambia), pero nunca queda EXECUTED sin correr.
    await finishAction(id, { status: "FAILED", resultMessage: "Conversación distinta" });
    return json({ ok: false, message: NO_PENDIENTE }, 409);
  }

  // Las dos herramientas con tarjeta no usan el enlace: el pagePath guardado no tiene el token, a propósito.
  const actor = await actorDesdeConversacion({
    conv, guestKey, ipHash: hashIp(ipDe(req)), pagina: null, pagePath: null,
    datos: { albumId: conv.albumId, orderId: conv.orderId, enlace: null }, sesion: await sesionVerificada(),
  });
  const tool = herramientasComprador(actor, {}).find((t) => t.name === action.toolName && t.kind === "write");
  const parsed = tool?.input.safeParse(action.input);
  if (!tool || !parsed?.success) {
    await finishAction(id, { status: "FAILED", resultMessage: "Herramienta o datos inválidos" });
    return json({ ok: false, message: "No pude hacerlo." }, 400);
  }

  let out: ToolOutcome;
  try {
    out = await tool.run(parsed.data, ACTOR_MOTOR_COMPRADOR);
  } catch (e) {
    // El detalle ya quedó en el log (herramientasComprador); el texto genérico es para el modelo.
    out = { ok: false, message: e instanceof AvisoAlComprador ? e.message : FALLA_AMABLE };
  }
  await finishAction(
    id,
    out.ok
      ? { status: "EXECUTED", before: out.before, after: out.after, resultMessage: out.message }
      : { status: "FAILED", resultMessage: out.message },
  );
  // Mismo texto que la ruta de fotógrafos: el modelo ve un solo formato para este evento.
  await appendMessages(conv.id, [
    {
      role: "user",
      content: `[Sistema] El usuario ${out.ok ? "confirmó" : "confirmó pero falló"} la acción ${id} («${action.summary}»). Resultado: ${out.message}`,
    },
  ]);
  return json({ ok: out.ok, message: out.message, canUndo: false });
}

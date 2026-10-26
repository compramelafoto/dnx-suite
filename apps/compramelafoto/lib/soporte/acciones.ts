import type { Prisma } from "@prisma/client";
import type { BotActor, BotTool, ToolOutcome } from "@repo/dnx-bot";
import { prisma } from "@/lib/prisma";
import { BOT_PLATFORM } from "@/lib/bot/config";
import { finishAction } from "@/lib/bot/store";
import { toolsForActor } from "@/lib/bot/herramientas";
import { herramientasComprador } from "@/lib/bot/comprador/herramientas";
import { ACTOR_MOTOR_COMPRADOR } from "@/lib/bot/comprador/identidad";
import { ACCIONES_PERMITIDAS, type AccionPermitida } from "./acciones-catalogo";
import { conversacionDeCaso } from "./caso-bot";
import { actorFotografo, compradorDeSoporte, esFotografo } from "./diagnostico/herramientas";

export type AccionPedida = { herramienta: AccionPermitida; input: Record<string, unknown> };

type TicketDeAccion = { id: number; requesterEmail: string | null; requesterRole: string | null };

const ACCION_TTL_MS = 60 * 60_000;

/**
 * Aplica una acción del catálogo del DNX Bot desde la ficha. La aprobación del admin reemplaza la
 * confirmación del dueño; corre sobre los datos del dueño del ticket y queda registrada en BotAction.
 */
export async function ejecutarAccionDeTicket(
  ticket: TicketDeAccion,
  accion: AccionPedida,
  admin: { id: number; name: string | null },
  /** Clave de esta acción dentro de una respuesta: si ya se aplicó con esa clave, no se repite. */
  clave?: string,
): Promise<ToolOutcome> {
  if (!(ACCIONES_PERMITIDAS as readonly string[]).includes(accion.herramienta)) {
    return { ok: false, message: "Esa acción no se puede aplicar desde soporte." };
  }
  const email = ticket.requesterEmail?.toLowerCase() ?? "";
  const resumen = `Aplicada por ${admin.name ?? "el admin"} desde el ticket #${ticket.id}`;
  if (clave) {
    const previa = await prisma.botAction.findFirst({
      where: { toolName: accion.herramienta, status: "EXECUTED", summary: { endsWith: `desde el ticket #${ticket.id}` }, input: { path: ["_clave"], equals: clave } },
      select: { id: true, resultMessage: true },
    });
    if (previa) return { ok: true, message: previa.resultMessage ?? "Ya se había aplicado." };
  }

  let actor: BotActor;
  let tools: BotTool[];
  let conversationId: string;
  let input: Record<string, unknown> = accion.input;
  if (esFotografo(ticket.requesterRole)) {
    const fotografo = await actorFotografo(email);
    if (!fotografo) return { ok: false, message: "No encontré la cuenta del fotógrafo con ese mail." };
    actor = fotografo;
    // Una conversación real del ticket: las herramientas del bot registran sus acciones contra ella.
    conversationId = (await conversacionDeCaso(ticket.id, "PHOTOGRAPHER", fotografo.userId)).id;
    tools = toolsForActor(actor, { conversationId });
  } else {
    if (!email) return { ok: false, message: "El ticket no tiene mail." };
    actor = { ...ACTOR_MOTOR_COMPRADOR };
    conversationId = (await conversacionDeCaso(ticket.id, "BUYER", null)).id;
    tools = herramientasComprador(compradorDeSoporte({ conversationId, email, albumId: null }), {});
    // Siempre sobre los pedidos del mail del ticket: el envío va al mail de esos pedidos.
    input = { ...accion.input, email };
  }

  const tool = tools.find((t) => t.name === accion.herramienta);
  const parsed = tool?.input.safeParse(input);
  if (!tool || !parsed?.success) return { ok: false, message: "Los datos de la acción no son válidos." };

  const registro = await prisma.botAction.create({
    data: {
      platform: BOT_PLATFORM,
      conversationId,
      userId: admin.id,
      toolName: tool.name,
      input: { ...(parsed.data as Record<string, unknown>), ...(clave ? { _clave: clave } : {}) } as Prisma.InputJsonValue,
      summary: resumen,
      expiresAt: new Date(Date.now() + ACCION_TTL_MS),
    },
    select: { id: true },
  });

  let r: ToolOutcome;
  try {
    r = await tool.run(parsed.data, actor);
  } catch (e) {
    console.error(`[soporte] acción ${tool.name} del ticket #${ticket.id} falló:`, e);
    r = { ok: false, message: e instanceof Error ? e.message : "La acción falló." };
  }
  await finishAction(
    registro.id,
    r.ok
      ? { status: "EXECUTED", before: r.before, after: r.after, resultMessage: r.message }
      : { status: "FAILED", resultMessage: r.message },
  );
  return r;
}

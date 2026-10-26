import type { BotActor, BotTool } from "@repo/dnx-bot";
import { prisma } from "@/lib/prisma";
import { toolsForActor } from "@/lib/bot/herramientas";
import { herramientasComprador } from "@/lib/bot/comprador/herramientas";
import { ACTOR_MOTOR_COMPRADOR, type CompradorActor } from "@/lib/bot/comprador/identidad";
import type { TicketParaDiagnostico } from "./diagnosticar";

/** Lecturas puras: ninguna envía mails ni cambia datos. */
export const LECTURAS_FOTOGRAFO = ["ver_album", "buscar_pedidos", "ver_pedido", "estado_mercadopago", "ver_progreso_escolar"] as const;
// ver_mi_descarga y ver_mi_pack quedan afuera: sólo funcionan con el enlace que la persona tiene abierto.
export const LECTURAS_COMPRADOR = ["buscar_album", "ver_album", "cotizar_fotos", "estado_de_pago", "mis_pedidos"] as const;

const ROLES_FOTOGRAFO = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);

export function esFotografo(requesterRole: string | null): boolean {
  return requesterRole != null && ROLES_FOTOGRAFO.has(requesterRole);
}

function soloLecturas(tools: BotTool[], permitidas: readonly string[]): BotTool[] {
  return tools.filter((t) => t.kind === "read" && permitidas.includes(t.name));
}

/** Actor con el que corre el diagnóstico (el dueño del ticket) y sus herramientas de lectura. */
export async function herramientasDeDiagnostico(t: TicketParaDiagnostico): Promise<{ actor: BotActor; tools: BotTool[] }> {
  const email = t.requesterEmail?.toLowerCase() ?? "";
  if (esFotografo(t.requesterRole)) {
    const user = email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, role: true, email: true, name: true } }) : null;
    if (!user) return { actor: { ...ACTOR_MOTOR_COMPRADOR }, tools: [] };
    const actor: BotActor = { userId: user.id, role: String(user.role), email: user.email, name: user.name };
    return { actor, tools: soloLecturas(toolsForActor(actor, { conversationId: t.conversacion?.id ?? `soporte-${t.id}` }), LECTURAS_FOTOGRAFO) };
  }
  const comprador: CompradorActor = {
    guestKey: "soporte",
    ipHash: "soporte",
    conversationId: t.conversacion?.id ?? `soporte-${t.id}`,
    pagina: null,
    pagePath: null,
    albumId: t.conversacion?.albumId ?? null,
    enlace: null,
    emailVerificado: email || null,
    userId: null,
  };
  return { actor: { ...ACTOR_MOTOR_COMPRADOR }, tools: soloLecturas(herramientasComprador(comprador, {}), LECTURAS_COMPRADOR) };
}

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

/**
 * Comprador "visto desde soporte": el mail del ticket cuenta como verificado, así las herramientas
 * del bot sólo encuentran los pedidos de ese mail.
 */
export function compradorDeSoporte(p: { conversationId: string; email: string; albumId: number | null }): CompradorActor {
  return {
    guestKey: "soporte",
    ipHash: "soporte",
    conversationId: p.conversationId,
    pagina: null,
    pagePath: null,
    albumId: p.albumId,
    enlace: null,
    emailVerificado: p.email || null,
    userId: null,
  };
}

/** Busca la cuenta del fotógrafo por el mail del ticket y arma su actor del bot. */
export async function actorFotografo(email: string): Promise<BotActor | null> {
  if (!email) return null;
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, role: true, email: true, name: true } });
  return user ? { userId: user.id, role: String(user.role), email: user.email, name: user.name } : null;
}

/** Actor con el que corre el diagnóstico (el dueño del ticket) y sus herramientas de lectura. */
export async function herramientasDeDiagnostico(t: TicketParaDiagnostico): Promise<{ actor: BotActor; tools: BotTool[] }> {
  const email = t.requesterEmail?.toLowerCase() ?? "";
  if (esFotografo(t.requesterRole)) {
    const actor = await actorFotografo(email);
    if (!actor) return { actor: { ...ACTOR_MOTOR_COMPRADOR }, tools: [] };
    return { actor, tools: soloLecturas(toolsForActor(actor, { conversationId: t.conversacion?.id ?? `soporte-${t.id}` }), LECTURAS_FOTOGRAFO) };
  }
  const comprador = compradorDeSoporte({ conversationId: t.conversacion?.id ?? `soporte-${t.id}`, email, albumId: t.conversacion?.albumId ?? null });
  return { actor: { ...ACTOR_MOTOR_COMPRADOR }, tools: soloLecturas(herramientasComprador(comprador, {}), LECTURAS_COMPRADOR) };
}

import { defineTool, z, type BotTool } from "@repo/dnx-bot";
import { prisma } from "@/lib/prisma";
import { BOT_PLATFORM, readBotConfig } from "@/lib/bot/config";
import { marcarVerificada } from "@/lib/bot/comprador/store";
import { aplicarEvento } from "./aplicar-evento";
import { itemsDeMensajes } from "./resumen-bot";
import { leerTokenCaso } from "./token-caso";

/**
 * "Modo caso" del DNX Bot: la persona vuelve desde el link del mail y sigue el reclamo en la ventana
 * del bot. El bot contesta siempre (presentándose como bot), con lo que ya se sabe del caso, y lo
 * cierra o lo devuelve al equipo según lo que diga la persona.
 */

export type ItemCaso = { rol: "usuario" | "bot" | "equipo"; texto: string; autor: string | null; fecha: string };

const VERIFICACION_CASO_MS = 86_400_000;
const FIRMA_EQUIPO = "equipo CompraMeLaFoto";
const esDuplicado = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

export async function historiaDeCaso(ticketId: number): Promise<{ ticket: { id: number; estado: string }; items: ItemCaso[] }> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, createdAt: true, requesterEmail: true } });
  if (!ticket) return { ticket: { id: ticketId, estado: "CLOSED" }, items: [] };
  const [conv, mensajes] = await Promise.all([
    prisma.botConversation.findFirst({
      where: { supportTicketId: ticketId },
      orderBy: { createdAt: "asc" },
      select: { id: true, messages: { orderBy: { seq: "asc" }, select: { role: true, content: true, createdAt: true } } },
    }),
    prisma.supportMessage.findMany({
      where: { ticketId, isInternal: false },
      orderBy: { createdAt: "asc" },
      select: { message: true, origen: true, authorName: true, authorEmail: true, createdAt: true },
    }),
  ]);

  // De la charla con el bot sólo va lo previo al ticket: lo posterior ya está espejado en el ticket.
  const previos = itemsDeMensajes((conv?.messages ?? []).filter((msg) => msg.createdAt <= ticket.createdAt))
    .filter((i) => i.rol !== "sistema")
    .map((i): ItemCaso => ({ rol: i.rol === "usuario" ? "usuario" : "bot", texto: i.texto, autor: null, fecha: i.fecha.toISOString() }));

  const delCaso = mensajes.map((msg): ItemCaso => {
    const esCliente =
      msg.origen === "CLIENTE_PANEL" || msg.origen === "CLIENTE_BOT" ||
      (msg.origen == null && !!msg.authorEmail && msg.authorEmail.toLowerCase() === ticket.requesterEmail?.toLowerCase());
    if (esCliente) return { rol: "usuario", texto: msg.message, autor: null, fecha: msg.createdAt.toISOString() };
    if (msg.origen === "BOT") return { rol: "bot", texto: msg.message, autor: null, fecha: msg.createdAt.toISOString() };
    return { rol: "equipo", texto: msg.message, autor: `${msg.authorName ?? "Daniel"} · ${FIRMA_EQUIPO}`, fecha: msg.createdAt.toISOString() };
  });

  return {
    ticket: { id: ticket.id, estado: String(ticket.status) },
    items: [...previos, ...delCaso].sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}

export async function situacionDeCaso(ticketId: number): Promise<string> {
  const [ticket, diagnostico, respuestas, acciones] = await Promise.all([
    prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, reason: true, description: true, status: true } }),
    prisma.supportDiagnosis.findUnique({ where: { ticketId }, select: { estado: true, resumen: true, hallazgos: true } }),
    prisma.supportMessage.findMany({ where: { ticketId, isInternal: false, origen: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { message: true, authorName: true } }),
    prisma.botAction.findMany({
      where: { platform: BOT_PLATFORM, status: "EXECUTED", summary: { endsWith: `desde el ticket #${ticketId}` } },
      orderBy: { createdAt: "asc" },
      select: { toolName: true, resultMessage: true },
    }),
  ]);
  return [
    `MODO CASO — la persona vuelve por el reclamo #${ticketId}${ticket ? ` (${ticket.reason}, estado ${ticket.status})` : ""}.`,
    ticket ? `Lo que planteó: ${ticket.description}` : "",
    diagnostico?.estado === "LISTO" ? `Diagnóstico del equipo: ${diagnostico.resumen ?? ""}\n${diagnostico.hallazgos ?? ""}` : "",
    respuestas.length ? `Respuestas del equipo:\n${respuestas.map((r) => `- ${r.authorName ?? "Daniel"}: ${r.message}`).join("\n")}` : "",
    acciones.length ? `Acciones ya aplicadas:\n${acciones.map((a) => `- ${a.toolName}: ${a.resultMessage ?? ""}`).join("\n")}` : "",
    [
      "Reglas del modo caso:",
      "- Sos DNX Bot, el asistente automático de CompraMeLaFoto. Decilo al empezar: la persona no está chateando con una persona del equipo.",
      "- Respondé con lo que ya se sabe del caso y con tus herramientas. Nunca prometas lo que no controlás (plazos, devoluciones, decisiones del equipo).",
      "- Terminá preguntando: «¿Se solucionó tu problema?».",
      "- Si dice que sí, usá cerrar_caso_resuelto y despedite.",
      "- Si dice que no, o pide algo que no podés resolver, usá pasar_caso_al_equipo y decile que el equipo le va a responder por mail.",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function herramientasDeCaso(ticketId: number): BotTool[] {
  return [
    defineTool({
      name: "cerrar_caso_resuelto",
      description: "Cierra el reclamo porque la persona confirmó que se solucionó. Usar sólo si lo dijo explícitamente.",
      kind: "read",
      input: z.strictObject({}),
      run: async () => {
        await aplicarEvento(ticketId, { tipo: "CLIENTE_CONFIRMO_RESUELTO" });
        return { ok: true, message: "Caso cerrado como resuelto." };
      },
    }),
    defineTool({
      name: "pasar_caso_al_equipo",
      description: "Devuelve el reclamo al equipo cuando no se solucionó o la persona necesita algo que no podés resolver.",
      kind: "read",
      input: z.strictObject({ motivo: z.string().min(3).max(500).describe("Qué falta resolver, en una frase") }),
      run: async ({ motivo }) => {
        await aplicarEvento(ticketId, { tipo: "BOT_PASO_AL_EQUIPO", motivo });
        return { ok: true, message: "Le pasé el caso al equipo: le van a responder por mail." };
      },
    }),
  ];
}

/** Copia el turno al ticket para que la ficha tenga la historia completa. Repetirlo no duplica. */
export async function espejarTurnoEnTicket(
  ticketId: number,
  turno: { turnoId: string; textoUsuario: string; textoBot: string },
): Promise<void> {
  const filas = [
    { origen: "CLIENTE_BOT", message: turno.textoUsuario, idempotencyKey: `${turno.turnoId}:u`, authorName: null },
    { origen: "BOT", message: turno.textoBot, idempotencyKey: `${turno.turnoId}:b`, authorName: "DNX Bot" },
  ];
  for (const f of filas) {
    if (!f.message.trim()) continue;
    try {
      await prisma.supportMessage.create({ data: { ticketId, isInternal: false, ...f } });
    } catch (e) {
      if (!esDuplicado(e)) throw e;
    }
  }
}

export async function conversacionDeCaso(ticketId: number, audiencia: "BUYER" | "PHOTOGRAPHER", userId: number | null): Promise<{ id: string }> {
  const existente = await prisma.botConversation.findFirst({
    where: { supportTicketId: ticketId, audience: audiencia, ...(userId != null ? { userId } : {}) },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existente) return { id: existente.id };
  const creada = await prisma.botConversation.create({
    data: { platform: BOT_PLATFORM, audience: audiencia, userId, supportTicketId: ticketId, status: "ESCALATED", model: readBotConfig().model, pagePath: "/caso" },
    select: { id: true },
  });
  return { id: creada.id };
}

/** Link del mail de un comprador: ata la conversación del caso a este navegador y la verifica 24 h. */
export async function casoParaComprador(
  token: string,
  inv: { guestKey: string; ipHash: string },
  now: Date = new Date(),
): Promise<{ ticketId: number; conversationId: string } | { error: "vencido" | "cerrado" }> {
  const t = await leerTokenCaso(token, now);
  if (!t) return { error: "vencido" };
  const ticket = await prisma.supportTicket.findUnique({ where: { id: t.ticketId }, select: { id: true, requesterEmail: true, status: true } });
  if (!ticket?.requesterEmail) return { error: "vencido" };
  // Un cierre definitivo no se reabre desde el link (sí un Resuelto).
  if (ticket.status === "CLOSED") return { error: "cerrado" };
  const conv = await conversacionDeCaso(ticket.id, "BUYER", null);
  await prisma.botConversation.update({ where: { id: conv.id }, data: { guestKey: inv.guestKey, ipHash: inv.ipHash } });
  await marcarVerificada(conv.id, ticket.requesterEmail, new Date(now.getTime() + VERIFICACION_CASO_MS));
  return { ticketId: ticket.id, conversationId: conv.id };
}

/** Link del mail de un fotógrafo: el token sólo ubica el caso; tiene que ser de la cuenta con sesión. */
export async function casoParaFotografo(
  token: string,
  user: { id: number; email: string },
  now: Date = new Date(),
): Promise<{ ticketId: number; conversationId: string } | { error: "vencido" | "ajeno" | "cerrado" }> {
  const t = await leerTokenCaso(token, now);
  if (!t) return { error: "vencido" };
  const ticket = await prisma.supportTicket.findUnique({ where: { id: t.ticketId }, select: { id: true, requesterEmail: true, status: true } });
  if (!ticket) return { error: "vencido" };
  if (ticket.requesterEmail?.toLowerCase() !== user.email.toLowerCase()) return { error: "ajeno" };
  if (ticket.status === "CLOSED") return { error: "cerrado" };
  const conv = await conversacionDeCaso(ticket.id, "PHOTOGRAPHER", user.id);
  return { ticketId: ticket.id, conversationId: conv.id };
}

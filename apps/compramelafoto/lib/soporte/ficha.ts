import { prisma } from "@/lib/prisma";
import { historiaDeCaso, type ItemCaso } from "./caso-bot";
import { estadoReloj, type EstadoTicket } from "./estados";

/** Todo lo que muestra la ficha completa de un reclamo en el tablero. */
export async function cargarFicha(ticketId: number, now: Date) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true, status: true, reason: true, description: true, requesterName: true, requesterEmail: true, requesterRole: true,
      createdAt: true, slaDesde: true,
      diagnostico: {
        select: { estado: true, categoria: true, resumen: true, hallazgos: true, respuestaSugerida: true, acciones: true, confianza: true, mailSinVerificar: true, error: true },
      },
    },
  });
  if (!ticket) return null;
  const [notas, acciones, historia] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { ticketId, isInternal: true, NOT: { origen: "SISTEMA" } },
      orderBy: { createdAt: "asc" },
      select: { message: true, authorName: true, createdAt: true },
    }),
    prisma.botAction.findMany({
      where: { summary: { endsWith: `desde el ticket #${ticketId}` } },
      orderBy: { createdAt: "asc" },
      select: { toolName: true, status: true, resultMessage: true, createdAt: true },
    }),
    historiaDeCaso(ticketId),
  ]);
  const { diagnostico, slaDesde, ...datos } = ticket;
  const reloj = estadoReloj({ status: ticket.status as EstadoTicket, slaDesde, createdAt: ticket.createdAt }, now);
  return {
    ticket: { ...datos, status: String(ticket.status) },
    reloj: reloj ? { color: reloj.color, venceEn: reloj.venceEn.toISOString() } : null,
    diagnostico,
    historia: historia.items as ItemCaso[],
    notas: notas.map((n) => ({ texto: n.message, autor: n.authorName, fecha: n.createdAt.toISOString() })),
    acciones: acciones.map((a) => ({ toolName: a.toolName, status: String(a.status), resultMessage: a.resultMessage, fecha: a.createdAt.toISOString() })),
  };
}

export type FichaCompleta = NonNullable<Awaited<ReturnType<typeof cargarFicha>>>;

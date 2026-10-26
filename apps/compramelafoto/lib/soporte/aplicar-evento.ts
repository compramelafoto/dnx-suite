import { prisma } from "@/lib/prisma";
import { avisarSoporte } from "./avisos";
import { transicion, type CambioTicket, type EstadoTicket, type EventoTicket } from "./estados";

/** Lee el ticket, calcula el cambio con `transicion`, lo guarda y manda el aviso si corresponde. */
export async function aplicarEvento(
  ticketId: number,
  e: EventoTicket,
  now: Date = new Date(),
): Promise<CambioTicket | { rechazado: string }> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } });
  if (!ticket) return { rechazado: "El ticket no existe." };

  const cambio = transicion({ id: ticket.id, status: ticket.status as EstadoTicket }, e, now);
  if ("rechazado" in cambio) return cambio;

  const { aviso, ...data } = cambio;
  if (Object.keys(data).length > 0) {
    await prisma.supportTicket.update({ where: { id: ticketId }, data });
  }
  if (aviso) await avisarSoporte(aviso);
  return cambio;
}

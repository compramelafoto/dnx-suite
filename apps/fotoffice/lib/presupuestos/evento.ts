import "server-only";
import { prisma } from "@repo/db";
import { diaDeCalendario } from "@/lib/consultas/fechas";

type Lector = { fotofficeConsulta: Pick<typeof prisma.fotofficeConsulta, "findFirst"> };

/**
 * "aaaa-mm-dd" del evento de la consulta de un presupuesto, en Argentina (la misma regla de toda
 * la app: `diaDeCalendario`), o null si no tiene fecha. Lo usan las opciones de pago: la de omisión
 * ofrece tantas cuotas como meses completos falten para el evento (con tope 6).
 */
export async function fechaDelEvento(workspaceId: string, leadId: string, cliente: Lector = prisma): Promise<string | null> {
  const c = await cliente.fotofficeConsulta.findFirst({ where: { leadId, workspaceId }, select: { eventStartsAt: true } });
  return c?.eventStartsAt ? diaDeCalendario(c.eventStartsAt) : null;
}

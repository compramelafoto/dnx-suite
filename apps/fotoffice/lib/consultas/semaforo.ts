import "server-only";
import { prisma } from "@repo/db";
import { ESTADOS_CAPTACION } from "@/lib/circuitos/constantes";
import { leerAjustes } from "./ajustes";
import { diaDeCalendario, sinFechaQueCuente } from "./fechas";
import { semaforosPorDia, type Semaforo } from "./semaforo-puro";

/**
 * El semáforo de fecha de estas consultas (ver `semaforo-puro.ts`). Lee de una vez, para todos los
 * días que aparecen, los pedidos no cancelados, las consultas ganadas y las abiertas del workspace.
 * Las consultas sin fecha, o de una categoría que no pide fecha (R11), no llevan semáforo.
 */

const DIA_MS = 24 * 60 * 60 * 1000;
/** Tope de filas por lectura: a la escala de un estudio, un rango de fechas no se acerca. */
const TOPE = 5000;

const agregar = (m: Map<string, Set<string>>, dia: string, clave: string) => {
  const s = m.get(dia) ?? new Set<string>();
  s.add(clave);
  m.set(dia, s);
};

export async function semaforosDeConsultas(workspaceId: string, consultas: readonly { leadId: string; fecha: Date | null }[]): Promise<Map<string, Semaforo>> {
  const conFecha = consultas.filter((c): c is { leadId: string; fecha: Date } => c.fecha instanceof Date && !Number.isNaN(c.fecha.getTime()));
  if (conFecha.length === 0) return new Map();
  const fuera = await sinFechaQueCuente(workspaceId, conFecha.map((c) => c.leadId));
  const pedidas = conFecha.filter((c) => !fuera.has(c.leadId)).map((c) => ({ leadId: c.leadId, dia: diaDeCalendario(c.fecha) }));
  if (pedidas.length === 0) return new Map();

  const dias = [...new Set(pedidas.map((c) => c.dia))].sort();
  const desde = new Date(new Date(`${dias[0]}T00:00:00.000Z`).getTime() - DIA_MS);
  const hasta = new Date(new Date(`${dias.at(-1)}T00:00:00.000Z`).getTime() + 2 * DIA_MS);
  const enLosDias = new Set(dias);

  const [pedidos, ganadas, abiertas, ajustes] = await Promise.all([
    prisma.fotofficePedido.findMany({
      where: { workspaceId, status: { not: "CANCELADO" }, eventDate: { gte: desde, lt: hasta } },
      select: { id: true, consultaLeadId: true, eventDate: true },
      take: TOPE,
    }),
    prisma.serviceSalesLead.findMany({
      where: { workspaceId, status: "WON", eventDate: { gte: desde, lt: hasta } },
      select: { id: true, eventDate: true },
      take: TOPE,
    }),
    prisma.serviceSalesLead.findMany({
      where: { workspaceId, status: { in: [...ESTADOS_CAPTACION] }, eventDate: { gte: desde, lt: hasta } },
      select: { id: true, eventDate: true },
      take: TOPE,
    }),
    leerAjustes(workspaceId),
  ]);

  const contratadosPorDia = new Map<string, Set<string>>();
  for (const p of pedidos) {
    if (!p.eventDate) continue;
    const dia = diaDeCalendario(p.eventDate);
    if (enLosDias.has(dia)) agregar(contratadosPorDia, dia, p.consultaLeadId ?? `pedido:${p.id}`);
  }
  // Una consulta ganada sin pedido (p. ej. cobrada por fuera) también tiene la fecha tomada. Con
  // pedido, ya está contada por su leadId: el Set no la repite.
  for (const g of ganadas) {
    if (!g.eventDate) continue;
    const dia = diaDeCalendario(g.eventDate);
    if (enLosDias.has(dia)) agregar(contratadosPorDia, dia, g.id);
  }
  const abiertasDelDia = abiertas.filter((a) => a.eventDate && enLosDias.has(diaDeCalendario(a.eventDate)));
  const sinFecha = await sinFechaQueCuente(workspaceId, abiertasDelDia.map((a) => a.id));
  const abiertasPorDia = new Map<string, Set<string>>();
  for (const a of abiertasDelDia) if (!sinFecha.has(a.id)) agregar(abiertasPorDia, diaDeCalendario(a.eventDate!), a.id);

  return semaforosPorDia(pedidas, contratadosPorDia, abiertasPorDia, ajustes.eventosPorDia);
}

import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { AGENDA_MODULE_KEY, puedeGestionarAgenda, puedeVerAgenda, type CtxAgenda } from "./acceso";
import { COLOR_TIPO_POR_OMISION } from "./constantes";
import { diaArgentina } from "./fechas";

/**
 * Las citas ligadas a un proyecto, un pedido o una consulta, para la tarjeta "Citas" de su ficha:
 * las próximas y las recientes. Sólo con el módulo Agenda encendido y "Ver" en Agenda; si no, null (la
 * tarjeta no se muestra y no se lee nada).
 */

export type OrigenDeCitas = { proyectoId: string } | { pedidoId: string } | { consultaLeadId: string };

export type CitaDeFicha = {
  id: string;
  titulo: string;
  /** Día de Argentina del inicio ("YYYY-MM-DD"). */
  dia: string;
  inicio: string;
  fin: string;
  todoElDia: boolean;
  estado: string;
  tipo: string | null;
  color: string;
};

export type CitasDeFicha = { proximas: CitaDeFicha[]; recientes: CitaDeFicha[]; puedeAgendar: boolean };

const POR_GRUPO = 5;

export async function citasDeOrigen(ctx: CtxAgenda, origen: OrigenDeCitas, ahora: Date = new Date()): Promise<CitasDeFicha | null> {
  if (!puedeVerAgenda(ctx)) return null;
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, AGENDA_MODULE_KEY))) return null;
  const donde = { workspaceId: ctx.workspaceId, status: { not: "ANULADA" }, ...origen };
  const select = { id: true, title: true, startAt: true, endAt: true, allDay: true, status: true, type: { select: { name: true, color: true } } } as const;
  const [proximas, recientes] = await Promise.all([
    prisma.fotofficeCita.findMany({ where: { ...donde, endAt: { gte: ahora } }, select, orderBy: [{ startAt: "asc" }, { id: "asc" }], take: POR_GRUPO }),
    prisma.fotofficeCita.findMany({ where: { ...donde, endAt: { lt: ahora } }, select, orderBy: [{ startAt: "desc" }, { id: "desc" }], take: POR_GRUPO }),
  ]);
  const aFicha = (f: (typeof proximas)[number]): CitaDeFicha => ({
    id: f.id as string,
    titulo: f.title as string,
    dia: diaArgentina(f.startAt as Date),
    inicio: (f.startAt as Date).toISOString(),
    fin: (f.endAt as Date).toISOString(),
    todoElDia: f.allDay as boolean,
    estado: f.status as string,
    tipo: (f.type?.name as string | undefined) ?? null,
    color: (f.type?.color as string | undefined) ?? COLOR_TIPO_POR_OMISION,
  });
  return { proximas: proximas.map(aFicha), recientes: recientes.map(aFicha), puedeAgendar: puedeGestionarAgenda(ctx) };
}

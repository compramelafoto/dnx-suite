import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { AGENDA_MODULE_KEY } from "@/lib/agenda/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import type { Interval } from "@/lib/bookings/time";
import { AJUSTES_TURNOS_DE_FABRICA, esModalidad, type AjustesTurnos, type Modalidad } from "./constantes";
import type { Franja } from "./franjas";

/** Lecturas públicas de los turnos: el negocio por su dirección, sus tipos publicados y lo ocupado. */

export type NegocioPublico = { workspaceId: string; slug: string; nombre: string; hostUserId: number | null };

export type TipoPublicado = {
  id: string;
  name: string;
  color: string;
  publicDescription: string | null;
  durationMinutes: number;
  modality: Modalidad;
  address: string | null;
  imageUrl: string | null;
  franjas: Franja[];
};

type Lector = Pick<Prisma.TransactionClient, "fotofficeCita" | "fotofficeTurno">;

/** El negocio por su dirección pública, sólo si tiene la Agenda encendida. */
export async function negocioPorSlug(slug: string): Promise<NegocioPublico | null> {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 120) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: slug }, select: { workspaceId: true } });
  if (!branding) return null;
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, AGENDA_MODULE_KEY))) return null;
  const [ws, dueno] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: branding.workspaceId }, select: { name: true } }),
    prisma.workspaceMembership.findFirst({ where: { workspaceId: branding.workspaceId, role: "WORKSPACE_OWNER" }, orderBy: { createdAt: "asc" }, select: { userId: true } }),
  ]);
  return { workspaceId: branding.workspaceId, slug, nombre: (ws?.name as string | undefined) ?? "", hostUserId: (dueno?.userId as number | undefined) ?? null };
}

export async function leerAjustesTurnos(workspaceId: string): Promise<AjustesTurnos> {
  const fila = await prisma.fotofficeTurnosAjustes.findUnique({ where: { workspaceId } });
  if (!fila) return { ...AJUSTES_TURNOS_DE_FABRICA };
  return {
    pageTitle: fila.pageTitle ?? null,
    pageIntro: fila.pageIntro ?? null,
    cancelWindowHours: fila.cancelWindowHours,
    bufferMinutes: fila.bufferMinutes,
    minAdvanceHours: fila.minAdvanceHours,
    maxAdvanceDays: fila.maxAdvanceDays,
    notifyEmail: fila.notifyEmail ?? null,
  };
}

const SELECT_TIPO = {
  id: true, name: true, color: true, publicDescription: true, durationMinutes: true, modality: true, address: true, imageUrl: true,
  franjas: { select: { weekday: true, startMinute: true, endMinute: true }, orderBy: [{ weekday: "asc" as const }, { startMinute: "asc" as const }] },
};

type FilaTipo = {
  id: string; name: string; color: string; publicDescription: string | null; durationMinutes: number | null; modality: string | null; address: string | null; imageUrl: string | null;
  franjas: Franja[];
};

function aPublicado(t: FilaTipo): TipoPublicado | null {
  if (!t.durationMinutes || !esModalidad(t.modality) || t.franjas.length === 0) return null;
  return { ...t, durationMinutes: t.durationMinutes, modality: t.modality };
}

export async function tiposPublicados(workspaceId: string): Promise<TipoPublicado[]> {
  const filas = (await prisma.fotofficeCitaTipo.findMany({
    where: { workspaceId, isActive: true, isBookable: true },
    select: SELECT_TIPO,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })) as FilaTipo[];
  return filas.map(aPublicado).filter((t): t is TipoPublicado => t !== null);
}

export async function tipoPublicado(workspaceId: string, tipoId: string): Promise<TipoPublicado | null> {
  if (typeof tipoId !== "string" || tipoId.length === 0 || tipoId.length > 64) return null;
  const t = (await prisma.fotofficeCitaTipo.findFirst({ where: { id: tipoId, workspaceId, isActive: true, isBookable: true }, select: SELECT_TIPO })) as FilaTipo | null;
  return t ? aPublicado(t) : null;
}

/**
 * Lo ocupado según la Agenda: las citas no anuladas (con hora) de quien atiende o sin responsable.
 * Los turnos confirmados ya son citas, así que entran por acá. `excluirCitaId` es la del turno que se
 * está reprogramando, que no se ocupa a sí mismo.
 */
export async function ocupadoEnAgenda(
  cliente: Lector,
  e: { workspaceId: string; hostUserId: number | null; desde: Date; hasta: Date; excluirCitaId?: string | null },
): Promise<Interval[]> {
  const citas = await cliente.fotofficeCita.findMany({
    where: {
      workspaceId: e.workspaceId,
      status: { not: "ANULADA" },
      allDay: false,
      startAt: { lt: e.hasta },
      endAt: { gt: e.desde },
      ...(e.hostUserId !== null ? { OR: [{ ownerUserId: e.hostUserId }, { ownerUserId: null }] } : {}),
      ...(e.excluirCitaId ? { id: { not: e.excluirCitaId } } : {}),
    },
    select: { startAt: true, endAt: true },
  });
  return citas.map((c) => ({ startAt: c.startAt as Date, endAt: c.endAt as Date }));
}

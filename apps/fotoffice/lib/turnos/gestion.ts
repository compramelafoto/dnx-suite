import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { rejectionMessage } from "@/lib/bookings/availability";
import type { Interval } from "@/lib/bookings/time";
import { MENSAJES_TURNOS, type AjustesTurnos } from "./constantes";
import { verificarHorario, ventanaDeBusqueda } from "./disponibilidad";
import { puedeGestionarse } from "./plazo";
import { ocupadoEnAgenda, type TipoPublicado } from "./publico";
import { hashDeToken, tokenConForma } from "./token";

/**
 * Lo que el cliente hace con su enlace: ver, cancelar y reprogramar su turno, hasta `cancelWindowHours`
 * antes del comienzo. Si el estudio anuló la cita en la Agenda, el turno se muestra como cancelado.
 */

export type TurnoDeGestion = {
  id: string;
  workspaceId: string;
  typeId: string;
  citaId: string | null;
  startAt: Date;
  endAt: Date;
  hostUserId: number | null;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  /** CANCELADO por el cliente, o la cita anulada por el estudio. */
  cancelado: boolean;
};

export async function turnoPorToken(token: unknown): Promise<TurnoDeGestion | null> {
  if (!tokenConForma(token)) return null;
  const t = await prisma.fotofficeTurno.findUnique({
    where: { manageTokenHash: hashDeToken(token) },
    select: {
      id: true, workspaceId: true, typeId: true, citaId: true, startAt: true, endAt: true, hostUserId: true, status: true,
      contactName: true, contactEmail: true, contactPhone: true, cita: { select: { status: true } },
    },
  });
  if (!t) return null;
  const { cita, ...resto } = t as typeof t & { cita: { status: string } | null };
  return { ...(resto as Omit<TurnoDeGestion, "cancelado">), cancelado: t.status === "CANCELADO" || cita?.status === "ANULADA" };
}

export type ResultadoGestion = { ok: true } | { ok: false; error: string };

export async function cancelarTurno(turno: TurnoDeGestion, ajustes: AjustesTurnos, ahora: Date): Promise<ResultadoGestion> {
  if (turno.cancelado) return { ok: false, error: MENSAJES_TURNOS.yaCancelado };
  if (!puedeGestionarse(turno.startAt, ahora, ajustes.cancelWindowHours)) return { ok: false, error: MENSAJES_TURNOS.fueraDePlazo };
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.fotofficeTurno.updateMany({
      where: { id: turno.id, workspaceId: turno.workspaceId, status: "CONFIRMADO" },
      data: { status: "CANCELADO", cancelledAt: ahora, cancelledBy: "CLIENTE", cancelledInWindow: true },
    });
    if (turno.citaId) await tx.fotofficeCita.updateMany({ where: { id: turno.citaId, workspaceId: turno.workspaceId }, data: { status: "ANULADA" } });
  });
  return { ok: true };
}

export async function reprogramarTurno(
  turno: TurnoDeGestion,
  tipo: TipoPublicado,
  ajustes: AjustesTurnos,
  inicio: Date,
  ocupadoGoogle: Interval[],
  ahora: Date,
): Promise<ResultadoGestion> {
  if (turno.cancelado) return { ok: false, error: MENSAJES_TURNOS.yaCancelado };
  if (!puedeGestionarse(turno.startAt, ahora, ajustes.cancelWindowHours)) return { ok: false, error: MENSAJES_TURNOS.fueraDePlazo };
  const fin = new Date(inicio.getTime() + tipo.durationMinutes * 60_000);
  return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<ResultadoGestion> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-turnos:${turno.workspaceId}`}))`;
    const ventana = ventanaDeBusqueda(ahora, ajustes.maxAdvanceDays);
    const agenda = await ocupadoEnAgenda(tx, { workspaceId: turno.workspaceId, hostUserId: turno.hostUserId, desde: ventana.startAt, hasta: ventana.endAt, excluirCitaId: turno.citaId });
    const check = verificarHorario(inicio, {
      reglas: { durationMinutes: tipo.durationMinutes, bufferMinutes: ajustes.bufferMinutes, minAdvanceHours: ajustes.minAdvanceHours, maxAdvanceDays: ajustes.maxAdvanceDays },
      franjas: tipo.franjas,
      ocupado: [...agenda, ...ocupadoGoogle],
      ahora,
    });
    if (!check.ok) return { ok: false, error: check.reason === "OCUPADO" ? MENSAJES_TURNOS.ocupado : rejectionMessage(check.reason).replace("el espacio", "este turno").replace("este espacio", "este turno") };
    await tx.fotofficeTurno.updateMany({ where: { id: turno.id, workspaceId: turno.workspaceId }, data: { startAt: inicio, endAt: fin } });
    if (turno.citaId) await tx.fotofficeCita.updateMany({ where: { id: turno.citaId, workspaceId: turno.workspaceId }, data: { startAt: inicio, endAt: fin } });
    return { ok: true };
  });
}

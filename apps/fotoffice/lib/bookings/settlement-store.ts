import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { summarizePending, type PendingSummary } from "./settlement";

/**
 * Liquidaciones a profesionales — la parte que toca la base.
 *
 * Se le debe a un profesional la parte congelada (`Booking.professionalShareArs`) de cada turno
 * CONFIRMADO que ya terminó y todavía no entró en ninguna liquidación. Registrar el pago crea
 * una `BookingSettlement` y le pone su id a esos turnos, en la misma transacción: si dos
 * personas aprietan a la vez, la segunda no encuentra nada pendiente y no se paga dos veces.
 */

export type PendingTurnRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  contactName: string;
  totalMinor: number;
  shareMinor: number;
  creditsUsed: number;
};

export type ProfessionalOverview = {
  spaceId: string;
  name: string;
  shareBps: number;
  pending: PendingSummary;
  turns: PendingTurnRow[];
  settlements: { id: string; amountMinor: number; bookingsCount: number; fromAt: Date; toAt: Date; paidAt: Date; note: string | null }[];
};

function filtroPendientes(workspaceId: string, spaceId: string, now: Date) {
  return {
    workspaceId,
    spaceId,
    status: "CONFIRMED",
    settlementId: null,
    professionalShareArs: { gt: 0 },
    endAt: { lte: now },
  };
}

/**
 * Cada profesional con porcentaje (o con algo pendiente de cuando lo tenía), lo que se le
 * debe y sus últimas liquidaciones. `spaceIds` acota a algunos (la vista del propio barbero).
 */
export async function loadSettlementOverview(input: {
  workspaceId: string;
  now?: Date;
  spaceIds?: string[];
}): Promise<ProfessionalOverview[]> {
  const now = input.now ?? new Date();
  const espacios = await prisma.bookingSpace.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.spaceIds ? { id: { in: input.spaceIds } } : {}),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, professionalShareBps: true, active: true },
  });

  const salida: ProfessionalOverview[] = [];
  for (const e of espacios) {
    const [turnos, liquidaciones] = await Promise.all([
      prisma.booking.findMany({
        where: filtroPendientes(input.workspaceId, e.id, now),
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          contactName: true,
          totalArs: true,
          professionalShareArs: true,
          creditsUsed: true,
        },
      }),
      prisma.bookingSettlement.findMany({
        where: { workspaceId: input.workspaceId, spaceId: e.id },
        orderBy: { paidAt: "desc" },
        take: 12,
        select: { id: true, amountArs: true, bookingsCount: true, fromAt: true, toAt: true, paidAt: true, note: true },
      }),
    ]);
    // Quien nunca tuvo porcentaje ni liquidaciones (Gus, que se queda con todo) no aparece.
    if (e.professionalShareBps <= 0 && turnos.length === 0 && liquidaciones.length === 0) continue;

    const filas: PendingTurnRow[] = turnos.map((t) => ({
      id: t.id,
      startAt: t.startAt,
      endAt: t.endAt,
      contactName: t.contactName,
      totalMinor: decimalArsToMinor(t.totalArs),
      shareMinor: decimalArsToMinor(t.professionalShareArs),
      creditsUsed: t.creditsUsed,
    }));
    salida.push({
      spaceId: e.id,
      name: e.name,
      shareBps: e.professionalShareBps,
      pending: summarizePending(filas, now),
      turns: filas,
      settlements: liquidaciones.map((l) => ({
        id: l.id,
        amountMinor: decimalArsToMinor(l.amountArs),
        bookingsCount: l.bookingsCount,
        fromAt: l.fromAt,
        toAt: l.toAt,
        paidAt: l.paidAt,
        note: l.note,
      })),
    });
  }
  return salida;
}

export type RegisterSettlementResult =
  | { ok: true; settlementId: string; amountMinor: number; count: number }
  | { ok: false; error: string };

/** Registra que la institución le pagó a un profesional todo lo pendiente hasta ahora. */
export async function registerSettlement(input: {
  workspaceId: string;
  spaceId: string;
  byUserId: number | null;
  note?: string | null;
  now?: Date;
}): Promise<RegisterSettlementResult> {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const pendientes = await tx.booking.findMany({
      where: filtroPendientes(input.workspaceId, input.spaceId, now),
      select: { id: true, startAt: true, endAt: true, professionalShareArs: true },
    });
    const resumen = summarizePending(
      pendientes.map((p) => ({ ...p, shareMinor: decimalArsToMinor(p.professionalShareArs) })),
      now,
    );
    if (resumen.count === 0 || !resumen.fromAt || !resumen.toAt) {
      return { ok: false as const, error: "No hay turnos pendientes de liquidar." };
    }

    const liquidacion = await tx.bookingSettlement.create({
      data: {
        workspaceId: input.workspaceId,
        spaceId: input.spaceId,
        amountArs: minorToDecimalString(resumen.totalMinor),
        bookingsCount: resumen.count,
        fromAt: resumen.fromAt,
        toAt: resumen.toAt,
        paidAt: now,
        note: input.note?.trim() || null,
        createdByUserId: input.byUserId,
      },
      select: { id: true },
    });
    // `settlementId: null` en el where: si otra liquidación ganó la carrera, acá no toca nada
    // y el conteo no coincide.
    const marcadas = await tx.booking.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) }, settlementId: null },
      data: { settlementId: liquidacion.id },
    });
    if (marcadas.count !== resumen.count) {
      throw new Error("Otra liquidación tomó estos turnos al mismo tiempo.");
    }
    return { ok: true as const, settlementId: liquidacion.id, amountMinor: resumen.totalMinor, count: resumen.count };
  });
}

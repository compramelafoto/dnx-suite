import "server-only";
import { prisma } from "@repo/db";
import type { RafflePrizeStatus } from "./constants";
import { recordRaffleEvent, type RaffleEventType } from "./events";
import { isRaffleClosed, nextPrizeStatus } from "./lifecycle";

/**
 * La vida del premio después del sorteo: avisar, entregar, vencer o anular.
 *
 * Lo que este archivo NO hace, a propósito: quitarle el premio a quien se dio de baja entre el
 * sorteo y el retiro. El premio sigue siendo suyo —las instantáneas del padrón guardan quién
 * era al momento de ganarlo— y qué se hace con eso lo decide la Secretaría, que deja
 * constancia en la nota. Un sistema que se lo saca solo estaría resolviendo por ella.
 */

const EVENTO_POR_ESTADO: Record<RafflePrizeStatus, RaffleEventType | null> = {
  GANADO: null,
  NOTIFICADO: "PREMIO_NOTIFICADO",
  RETIRADO: "PREMIO_ENTREGADO",
  NO_RETIRADO: "PREMIO_NO_RETIRADO",
  ANULADO: "PREMIO_ANULADO",
};

export type AdvanceResult = { ok: true } | { ok: false; error: string };

export async function advancePrizeAward(input: {
  workspaceId: string;
  awardId: string;
  to: RafflePrizeStatus;
  note: string | null;
  actorUserId: number;
  actorLabel: string;
  now?: Date;
}): Promise<AdvanceResult> {
  const now = input.now ?? new Date();

  const premio = await prisma.rafflePrizeAward.findFirst({
    where: { id: input.awardId, raffle: { workspaceId: input.workspaceId } },
    select: {
      id: true,
      raffleId: true,
      prizeId: true,
      status: true,
      raffle: {
        select: { id: true, workspaceId: true, awards: { select: { id: true, status: true } } },
      },
    },
  });
  if (!premio) return { ok: false, error: "Ese premio no existe." };

  const permiso = nextPrizeStatus(premio.status as RafflePrizeStatus, input.to, input.note);
  if (!permiso.ok) return permiso;

  const datos: Record<string, unknown> = { status: input.to };
  if (input.to === "NOTIFICADO") datos.notifiedAt = now;
  if (input.to === "RETIRADO") {
    datos.deliveredAt = now;
    datos.deliveredByUserId = input.actorUserId;
    datos.deliveryNote = input.note;
  }
  if (input.to === "ANULADO") datos.voidReason = input.note;

  // Cómo quedaría el sorteo con este cambio ya aplicado. Se calcula antes de escribir para
  // que el cierre y el cambio entren juntos: un sorteo que quedara SORTEADO con todos los
  // premios resueltos sería una lista de pendientes falsa.
  const estadosDespues = premio.raffle.awards.map((a) =>
    a.id === premio.id ? input.to : (a.status as RafflePrizeStatus),
  );
  const cierra = isRaffleClosed(estadosDespues);

  await prisma.$transaction(async (tx) => {
    await tx.rafflePrizeAward.update({ where: { id: premio.id }, data: datos });
    if (cierra) {
      await tx.raffle.update({ where: { id: premio.raffleId }, data: { status: "CERRADO" } });
    }
    const tipo = EVENTO_POR_ESTADO[input.to];
    if (tipo) {
      await recordRaffleEvent(tx, {
        raffleId: premio.raffleId,
        type: tipo,
        actorUserId: input.actorUserId,
        actorLabel: input.actorLabel,
        note: input.note,
        prizeId: premio.prizeId,
      });
    }
  });

  return { ok: true };
}

/** Los premios que todavía hay que avisar o entregar, lo que vence primero arriba. */
export async function listPendingAwards(workspaceId: string) {
  return prisma.rafflePrizeAward.findMany({
    where: { raffle: { workspaceId }, status: { in: ["GANADO", "NOTIFICADO"] } },
    orderBy: [{ prize: { pickupDeadline: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      notifiedAt: true,
      noticeError: true,
      sponsorNotifiedAt: true,
      sponsorNoticeError: true,
      receiptReceivedAt: true,
      receiptFileUrl: true,
      raffle: { select: { id: true, title: true } },
      prize: {
        select: {
          title: true,
          partnerNameSnapshot: true,
          partnerEmailSnapshot: true,
          partnerAddressSnapshot: true,
          pickupDeadline: true,
          pickupInstructions: true,
        },
      },
      member: {
        select: { memberNumber: true, firstName: true, lastName: true, email: true, phone: true },
      },
    },
  });
}

/**
 * Vence los premios que nadie retiró dentro del plazo. La usa la tarea programada.
 *
 * No cierra el sorteo acá aunque el vencimiento sea el último premio pendiente: eso lo
 * resuelve la próxima acción de la Secretaría o la propia pantalla. Un cierre automático en
 * lote escondería que el plazo venció, que es justo lo que hay que ver.
 */
export async function expireUnclaimedPrizes(
  now: Date = new Date(),
): Promise<{ vencidos: number }> {
  const vencidos = await prisma.rafflePrizeAward.findMany({
    where: {
      status: { in: ["GANADO", "NOTIFICADO"] },
      prize: { pickupDeadline: { lt: now } },
    },
    select: { id: true, raffleId: true, prizeId: true },
  });
  if (vencidos.length === 0) return { vencidos: 0 };

  await prisma.rafflePrizeAward.updateMany({
    where: { id: { in: vencidos.map((v) => v.id) } },
    data: { status: "NO_RETIRADO" },
  });
  for (const v of vencidos) {
    await recordRaffleEvent(prisma, {
      raffleId: v.raffleId,
      type: "PREMIO_NO_RETIRADO",
      prizeId: v.prizeId,
      note: "Venció el plazo de retiro.",
    });
  }

  return { vencidos: vencidos.length };
}

/**
 * Registra el remito que mandó el aliado cuando el socio retiró el premio.
 *
 * Es el respaldo de cómo llegó el premio a la institución: sin esto, la Sociedad no puede
 * justificar de dónde salió, y el aliado no puede justificar la salida de su stock. Llega por
 * correo y alguien lo carga acá.
 *
 * No cambia el estado del premio: son dos cosas distintas. Un premio puede estar retirado y
 * todavía sin comprobante, y esa es justamente la situación que hay que poder ver.
 */
export async function registerPrizeReceipt(input: {
  workspaceId: string;
  awardId: string;
  fileUrl: string | null;
  note: string | null;
  actorUserId: number;
  actorLabel: string;
  now?: Date;
}): Promise<AdvanceResult> {
  const now = input.now ?? new Date();

  const premio = await prisma.rafflePrizeAward.findFirst({
    where: { id: input.awardId, raffle: { workspaceId: input.workspaceId } },
    select: { id: true, raffleId: true, prizeId: true },
  });
  if (!premio) return { ok: false, error: "Ese premio no existe." };

  if (!input.fileUrl && !(input.note ?? "").trim()) {
    return {
      ok: false,
      error: "Cargá el archivo del remito o al menos una nota que diga cómo llegó.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rafflePrizeAward.update({
      where: { id: premio.id },
      data: { receiptReceivedAt: now, receiptFileUrl: input.fileUrl, receiptNote: input.note },
    });
    await recordRaffleEvent(tx, {
      raffleId: premio.raffleId,
      type: "PREMIO_ENTREGADO",
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
      prizeId: premio.prizeId,
      note: `Comprobante registrado.${input.note ? " " + input.note : ""}`,
    });
  });

  return { ok: true };
}

/** Los premios entregados a los que todavía les falta el comprobante del aliado. */
export async function listAwardsMissingReceipt(workspaceId: string) {
  return prisma.rafflePrizeAward.findMany({
    where: {
      raffle: { workspaceId },
      status: "RETIRADO",
      receiptReceivedAt: null,
      prize: { partnerId: { not: null } },
    },
    orderBy: { deliveredAt: "asc" },
    select: {
      id: true,
      deliveredAt: true,
      raffle: { select: { title: true } },
      prize: { select: { title: true, partnerNameSnapshot: true, partnerEmailSnapshot: true } },
      member: { select: { memberNumber: true, firstName: true, lastName: true } },
    },
  });
}

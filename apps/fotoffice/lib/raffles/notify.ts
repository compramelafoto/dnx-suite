import "server-only";
import { prisma } from "@repo/db";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { buildSponsorNoticeEmail, buildWinnerNoticeEmail } from "./emails";
import { recordRaffleEvent } from "./events";

/**
 * Los avisos que salen cuando un sorteo se resuelve.
 *
 * Viven fuera de `resolveRaffle` a propósito. El sorteo es un hecho consumado en cuanto se
 * escribe el resultado; un correo que rebota no puede deshacerlo, y tampoco puede quedar sin
 * reintentarse. Separarlos hace que el reintento sea lo natural: esta función busca lo que
 * todavía no salió y lo manda, corra desde la tarea programada o desde un botón.
 *
 * Es idempotente: `notifiedAt` y `sponsorNotifiedAt` sólo se escriben cuando el envío salió
 * bien, así que lo que falló vuelve a intentarse solo en la pasada siguiente. Lo que ya salió
 * no se manda dos veces.
 *
 * Los dos correos son independientes: que el socio no tenga dirección de correo no puede
 * impedir que al aliado le llegue el aviso de a quién entregarle el premio.
 */

export type NotifyReport = {
  ganadores: number;
  aliados: number;
  fallados: number;
};

export async function notifyPendingAwards(now: Date = new Date()): Promise<NotifyReport> {
  const pendientes = await prisma.rafflePrizeAward.findMany({
    where: {
      status: { in: ["GANADO", "NOTIFICADO"] },
      OR: [{ notifiedAt: null }, { sponsorNotifiedAt: null }],
    },
    select: {
      id: true,
      raffleId: true,
      notifiedAt: true,
      sponsorNotifiedAt: true,
      member: { select: { firstName: true, lastName: true, memberNumber: true, email: true } },
      prize: {
        select: {
          title: true,
          conditions: true,
          pickupDeadline: true,
          partnerNameSnapshot: true,
          partnerEmailSnapshot: true,
          partnerAddressSnapshot: true,
          partnerPhoneSnapshot: true,
          partnerHoursSnapshot: true,
        },
      },
      raffle: {
        select: {
          id: true,
          title: true,
          workspaceId: true,
          // El correo institucional vive en el branding del workspace, que es donde FotOffice
          // guarda los datos de contacto que ya usa el pie de todos los demás correos.
          workspace: {
            select: { name: true, fotofficeBranding: { select: { contactEmail: true } } },
          },
        },
      },
    },
    take: 200,
  });

  let ganadores = 0;
  let aliados = 0;
  let fallados = 0;

  for (const a of pendientes) {
    // Sin plazo no hay nada que avisar: el correo entero gira alrededor de esa fecha.
    if (!a.prize.pickupDeadline) continue;

    const firma = await loadWorkspaceSignature(a.raffle.workspaceId);
    const base = {
      raffleTitle: a.raffle.title,
      prizeTitle: a.prize.title,
      prizeConditions: a.prize.conditions,
      partnerName: a.prize.partnerNameSnapshot ?? a.raffle.workspace.name,
      partnerAddress: a.prize.partnerAddressSnapshot,
      partnerPhone: a.prize.partnerPhoneSnapshot,
      partnerHours: a.prize.partnerHoursSnapshot,
      pickupDeadline: a.prize.pickupDeadline,
      institutionName: a.raffle.workspace.name,
      signature: firma,
    };

    // ── Al ganador ──
    if (a.notifiedAt === null) {
      if (!a.member.email) {
        await prisma.rafflePrizeAward.update({
          where: { id: a.id },
          data: { noticeError: "El socio no tiene correo cargado. Hay que avisarle por teléfono." },
        });
        fallados += 1;
      } else {
        const salida = await sendAndLogEmail({
          to: a.member.email,
          templateKey: "raffle-winner",
          body: buildWinnerNoticeEmail({ ...base, winnerFirstName: a.member.firstName }),
        });
        if (salida.status === "SENT") {
          await prisma.rafflePrizeAward.update({
            where: { id: a.id },
            data: { notifiedAt: now, noticeError: null, status: "NOTIFICADO" },
          });
          await recordRaffleEvent(prisma, {
            raffleId: a.raffleId,
            type: "PREMIO_NOTIFICADO",
            note: `Aviso enviado a ${a.member.email}.`,
          });
          ganadores += 1;
        } else {
          await prisma.rafflePrizeAward.update({
            where: { id: a.id },
            data: { noticeError: detalle(salida) },
          });
          fallados += 1;
        }
      }
    }

    // ── Al aliado ──
    if (a.sponsorNotifiedAt === null) {
      const receiptEmail = a.raffle.workspace.fotofficeBranding?.contactEmail ?? null;
      if (!a.prize.partnerEmailSnapshot || !receiptEmail) {
        await prisma.rafflePrizeAward.update({
          where: { id: a.id },
          data: {
            sponsorNoticeError: !a.prize.partnerEmailSnapshot
              ? "El aliado no tiene correo cargado en el premio."
              : "La institución no tiene correo de contacto cargado: no hay adónde pedir el remito.",
          },
        });
        fallados += 1;
      } else {
        const salida = await sendAndLogEmail({
          to: a.prize.partnerEmailSnapshot,
          templateKey: "raffle-sponsor",
          body: buildSponsorNoticeEmail({
            ...base,
            winnerFullName: `${a.member.firstName} ${a.member.lastName}`.trim(),
            winnerMemberNumber: a.member.memberNumber,
            receiptEmail,
          }),
        });
        if (salida.status === "SENT") {
          await prisma.rafflePrizeAward.update({
            where: { id: a.id },
            data: { sponsorNotifiedAt: now, sponsorNoticeError: null },
          });
          await recordRaffleEvent(prisma, {
            raffleId: a.raffleId,
            type: "PREMIO_NOTIFICADO",
            note: `Aviso enviado al aliado ${a.prize.partnerNameSnapshot ?? ""} (${a.prize.partnerEmailSnapshot}).`,
          });
          aliados += 1;
        } else {
          await prisma.rafflePrizeAward.update({
            where: { id: a.id },
            data: { sponsorNoticeError: detalle(salida) },
          });
          fallados += 1;
        }
      }
    }
  }

  return { ganadores, aliados, fallados };
}

function detalle(salida: { status: string; detail?: string }): string {
  return `${salida.status}${salida.detail ? ": " + salida.detail : ""}`;
}

import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { RAFFLES_MODULE_KEY } from "./constants";
import { buildInstitutionSummaryEmail } from "./institution-email";

/**
 * El resumen con los ganadores para la propia institución, una vez por sorteo.
 *
 * Va al correo de contacto del branding, el mismo al que los aliados mandan los remitos.
 *
 * ── Cuándo sale ──
 *
 * Después de que se intentaron los avisos al ganador y al aliado de cada premio: el resumen
 * dice cuáles salieron y cuáles no, y mandarlo antes diría "no le pudimos avisar" de algo que
 * todavía no se intentó. Como `notifyPendingAwards` corre antes en la misma pasada, en la
 * práctica sale en la misma tanda que los avisos. Si algún premio no se puede ni intentar (le
 * falta el plazo de retiro), el resumen sale igual pasada `ESPERA_MAX_MS` desde el sorteo.
 *
 * ── Cómo no se manda dos veces ──
 *
 * Cuando sale, se anota el evento `RESUMEN_INSTITUCION_ENVIADO` y el sorteo deja de mirarse.
 * Si el proveedor lo rechazó `MAX_FALLOS` veces, se deja de intentar. Sólo se miran sorteos de
 * los últimos `VENTANA_DIAS` días: al publicar esto no sale un resumen por cada sorteo viejo.
 */

const VENTANA_DIAS = 7;
const MAX_FALLOS = 3;
const ESPERA_MAX_MS = 60 * 60 * 1000;
export const INSTITUTION_SUMMARY_EVENT = "RESUMEN_INSTITUCION_ENVIADO";

export function institutionSummaryTemplateKey(raffleId: string): string {
  return `raffle-institution:${raffleId}`;
}

export type InstitutionSummaryReport = { enviados: number; fallados: number };

export async function sendPendingInstitutionSummaries(
  now: Date = new Date(),
): Promise<InstitutionSummaryReport> {
  const desde = new Date(now.getTime() - VENTANA_DIAS * 86_400_000);
  const sorteos = await prisma.raffle.findMany({
    where: {
      status: { in: ["SORTEADO", "CERRADO"] },
      drawnAt: { gte: desde },
      events: { none: { type: INSTITUTION_SUMMARY_EVENT } },
    },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      drawsAt: true,
      drawnAt: true,
      entrantsCount: true,
      workspace: { select: { fotofficeBranding: { select: { contactEmail: true } } } },
      prizes: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          partnerNameSnapshot: true,
          pickupDeadline: true,
          award: {
            select: {
              status: true,
              notifiedAt: true,
              noticeError: true,
              sponsorNotifiedAt: true,
              sponsorNoticeError: true,
              member: {
                select: { firstName: true, lastName: true, memberNumber: true, email: true, phone: true },
              },
            },
          },
        },
      },
    },
  });

  const reporte: InstitutionSummaryReport = { enviados: 0, fallados: 0 };

  for (const s of sorteos) {
    const to = s.workspace.fotofficeBranding?.contactEmail?.trim();
    if (!to) continue;
    if (!(await isModuleEnabledForWorkspace(s.workspaceId, RAFFLES_MODULE_KEY))) continue;

    const ganados = s.prizes.flatMap((p) =>
      p.award && p.award.status !== "ANULADO" ? [{ prize: p, award: p.award }] : [],
    );
    if (ganados.length === 0) continue;

    const intentados = ganados.every(
      ({ award: a }) =>
        (a.notifiedAt !== null || a.noticeError !== null) &&
        (a.sponsorNotifiedAt !== null || a.sponsorNoticeError !== null),
    );
    const esperoDemasiado = s.drawnAt !== null && now.getTime() - s.drawnAt.getTime() >= ESPERA_MAX_MS;
    if (!intentados && !esperoDemasiado) continue;

    const clave = institutionSummaryTemplateKey(s.id);
    const rechazos = await prisma.sentEmailLog.count({
      where: { templateKey: clave, status: "PROVIDER_REJECTED" },
    });
    if (rechazos >= MAX_FALLOS) continue;

    const v = await loadPersonVocabulary(s.workspaceId);
    const base = appUrl();
    const salida = await sendAndLogEmail({
      workspaceId: s.workspaceId,
      to,
      templateKey: clave,
      body: buildInstitutionSummaryEmail({
        raffleTitle: s.title,
        drawsAt: s.drawsAt,
        entrantsCount: s.entrantsCount ?? 0,
        pickupDeadline: ganados.find((g) => g.prize.pickupDeadline)?.prize.pickupDeadline ?? null,
        memberWord: v.singular,
        memberWordPlural: v.plural,
        adminUrl: base ? `${base}/sorteos/${s.id}` : null,
        signature: await loadWorkspaceSignature(s.workspaceId),
        prizes: ganados.map(({ prize: p, award: a }) => ({
          prizeTitle: p.title,
          partnerName: p.partnerNameSnapshot,
          winnerFullName: `${a.member.firstName} ${a.member.lastName}`.trim(),
          winnerMemberNumber: a.member.memberNumber,
          winnerEmail: a.member.email,
          winnerPhone: a.member.phone,
          winnerNotified: a.notifiedAt !== null,
          winnerNoticeError: a.noticeError,
          sponsorNotified: a.sponsorNotifiedAt !== null,
          sponsorNoticeError: a.sponsorNoticeError,
        })),
      }),
    });

    if (salida.status === "SENT") {
      await prisma.raffleEvent.create({
        data: {
          raffleId: s.id,
          type: INSTITUTION_SUMMARY_EVENT,
          actorLabel: "Sistema",
          note: `Resumen enviado a ${to}.`,
        },
      });
      reporte.enviados += 1;
    } else {
      reporte.fallados += 1;
      // Sin configuración no va a salir ninguno: se reintenta en la próxima pasada.
      if (salida.status === "CONFIGURATION_ERROR") return reporte;
    }
  }

  return reporte;
}

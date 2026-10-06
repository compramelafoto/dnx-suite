import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { RAFFLES_MODULE_KEY } from "./constants";
import { buildResultsEmail } from "./emails";
import { nombrePublico } from "./public-name";

/**
 * El correo con los resultados a todos los socios activos, una vez hecho el sorteo.
 *
 * ── Cómo no se manda dos veces ──
 *
 * Cada envío queda en `SentEmailLog` con la clave `raffle-results:<sorteo>`. Antes de mandar se
 * mira a qué direcciones ya les salió con esa clave, así que la tarea puede correr las veces que
 * sea y cada socio lo recibe una sola vez. Cuando no queda nadie, se anota el evento
 * `RESULTADOS_ENVIADOS` y el sorteo deja de mirarse.
 *
 * ── Los topes ──
 *
 * - Por pasada, `POR_PASADA` correos, uno cada `PAUSA_MS`: el proveedor limita los envíos por
 *   segundo y la tarea tiene cinco minutos. Lo que no entra sale en la pasada siguiente.
 * - Una dirección que falló `MAX_FALLOS` veces no se reintenta: una dirección mal escrita no
 *   puede generar un intento cada quince minutos para siempre.
 * - Sólo sorteos hechos en los últimos `VENTANA_DIAS` días: al publicar esto por primera vez no
 *   tiene que salir un correo por cada sorteo viejo.
 */

const POR_PASADA = 120;
const PAUSA_MS = 600;
const MAX_FALLOS = 3;
const VENTANA_DIAS = 7;
export const RESULTS_SENT_EVENT = "RESULTADOS_ENVIADOS";

export function resultsTemplateKey(raffleId: string): string {
  return `raffle-results:${raffleId}`;
}

export type ResultsMailReport = { enviados: number; fallados: number; completos: number };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendPendingRaffleResults(now: Date = new Date()): Promise<ResultsMailReport> {
  const desde = new Date(now.getTime() - VENTANA_DIAS * 86_400_000);
  const sorteos = await prisma.raffle.findMany({
    where: {
      status: { in: ["SORTEADO", "CERRADO"] },
      drawnAt: { gte: desde },
      events: { none: { type: RESULTS_SENT_EVENT } },
    },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      workspace: { select: { fotofficeBranding: { select: { publicSlug: true } } } },
      entries: {
        select: {
          memberId: true,
          position: true,
          memberNumberSnapshot: true,
          fullNameSnapshot: true,
          member: { select: { firstName: true, lastName: true } },
        },
      },
      prizes: {
        orderBy: { order: "asc" },
        select: { title: true, partnerNameSnapshot: true, award: { select: { winnerPosition: true } } },
      },
    },
  });

  const reporte: ResultsMailReport = { enviados: 0, fallados: 0, completos: 0 };
  let cupo = POR_PASADA;

  for (const s of sorteos) {
    if (cupo <= 0) break;
    // La tarea recorre todas las instituciones: la que apagó los sorteos no manda nada.
    if (!(await isModuleEnabledForWorkspace(s.workspaceId, RAFFLES_MODULE_KEY))) continue;

    const v = await loadPersonVocabulary(s.workspaceId);
    const porPosicion = new Map(s.entries.map((e) => [e.position, e]));
    const winners = s.prizes.flatMap((p) => {
      const e = p.award ? porPosicion.get(p.award.winnerPosition) : undefined;
      if (!e) return [];
      const nombre = nombrePublico(e.member?.firstName, e.member?.lastName, e.fullNameSnapshot);
      return [
        {
          prizeTitle: p.title,
          partnerName: p.partnerNameSnapshot,
          winnerName: `${nombre} · ${v.Singular} N° ${e.memberNumberSnapshot}`,
        },
      ];
    });
    if (winners.length === 0) continue;

    const base = appUrl();
    const slug = s.workspace.fotofficeBranding?.publicSlug;
    const publicUrl = base && slug ? `${base}/w/${slug}/sorteos/${s.id}` : null;
    const participantes = new Set(s.entries.map((e) => e.memberId));
    const clave = resultsTemplateKey(s.id);

    const [socios, registros] = await Promise.all([
      prisma.member.findMany({
        where: { workspaceId: s.workspaceId, status: "ACTIVE", email: { not: null } },
        select: { id: true, firstName: true, email: true, userId: true },
        orderBy: { memberNumber: "asc" },
      }),
      prisma.sentEmailLog.findMany({ where: { templateKey: clave }, select: { to: true, status: true } }),
    ]);

    const enviados = new Set<string>();
    const fallos = new Map<string, number>();
    for (const r of registros) {
      const to = r.to.trim().toLowerCase();
      if (r.status === "SENT") enviados.add(to);
      // Sólo cuenta el rechazo del proveedor, que habla de la dirección. Un error de
      // configuración o interno no es culpa de la dirección y no la descarta.
      else if (r.status === "PROVIDER_REJECTED") fallos.set(to, (fallos.get(to) ?? 0) + 1);
    }

    // Una dirección compartida por dos fichas recibe un solo correo.
    const vistos = new Set<string>();
    const pendientes = socios.filter((m) => {
      const to = m.email?.trim().toLowerCase();
      if (!to || vistos.has(to)) return false;
      vistos.add(to);
      return !enviados.has(to) && (fallos.get(to) ?? 0) < MAX_FALLOS;
    });

    if (pendientes.length === 0) {
      await prisma.raffleEvent.create({
        data: {
          raffleId: s.id,
          type: RESULTS_SENT_EVENT,
          actorLabel: "Sistema",
          note: `${enviados.size} correos con los resultados`,
        },
      });
      reporte.completos += 1;
      continue;
    }

    const firma = await loadWorkspaceSignature(s.workspaceId);
    for (const m of pendientes.slice(0, cupo)) {
      const salida = await sendAndLogEmail({
        workspaceId: s.workspaceId,
        to: (m.email as string).trim(),
        templateKey: clave,
        userId: m.userId,
        body: buildResultsEmail({
          raffleTitle: s.title,
          winners,
          publicUrl,
          recipientFirstName: m.firstName,
          participated: participantes.has(m.id),
          memberWordPlural: v.plural,
          signature: firma,
        }),
      });
      if (salida.status === "SENT") reporte.enviados += 1;
      else reporte.fallados += 1;
      // Sin configuración no va a salir ninguno: se corta y se reintenta en la próxima pasada.
      if (salida.status === "CONFIGURATION_ERROR") return reporte;
      cupo -= 1;
      await esperar(PAUSA_MS);
    }
  }

  return reporte;
}

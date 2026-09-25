import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";

import { requireAuth } from "../../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../../lib/fotorank/access/super-admin";
import { baseDelConcurso } from "../../../../lib/fotorank/jury/baseDelConcurso";
import { getCoverageReport } from "../../../../lib/fotorank/jury/scoring-session-service";
import {
  cerrarEvaluacionAction,
  finalizarRankingAction,
  generarRankingAction,
} from "../../../../actions/juzgamientoDeMaraton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ aviso?: string }>;
};

const ESTADO_SESION: Record<string, string> = {
  DRAFT: "Preparada, sin abrir",
  OPEN: "Abierta: los jurados están calificando",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
  LOCKED: "Cerrada y bloqueada",
};
const ESTADO_RANKING: Record<string, string> = {
  GENERATED: "Generado",
  REVIEW_REQUIRED: "Hay que revisar: obras incompletas o empates por premios",
  READY_TO_FINALIZE: "Listo para finalizar",
  FINALIZED: "Finalizado",
  PUBLISHED: "Publicado",
};
const PREMIO: Record<string, string> = {
  FIRST_PLACE: "1.º",
  SECOND_PLACE: "2.º",
  THIRD_PLACE: "3.º",
  FINALIST: "Finalista",
};

/**
 * El juzgamiento de una maratón: avance de los jurados, cierre y ranking.
 *
 * Hasta el 2026-09-25 no existía: la maratón vive en la base de Clickatón, el
 * panel de concursos de FotoRank no la encuentra y los resultados sólo se
 * podían sacar con scripts. Sólo la ve el super admin.
 */
export default async function JuzgamientoDeMaratonPage({ params, searchParams }: Props) {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) redirect("/mi-actividad");
  const { contestId } = await params;
  const { aviso } = await searchParams;

  const { db } = await baseDelConcurso(contestId);
  const concurso = await db.fotorankContest.findUnique({
    where: { id: contestId },
    select: { title: true },
  });
  if (!concurso) notFound();

  const sesion = await db.fotorankJuryScoringSession.findFirst({
    where: { contestId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, minimumEvaluationsPerEntry: true },
  });

  const cobertura = sesion ? await getCoverageReport(contestId, sesion.id) : null;

  // Avance por jurado.
  const porJurado = sesion
    ? await db.fotorankJuryEvaluation.groupBy({
        by: ["jurorId", "status"],
        where: { scoringSessionId: sesion.id },
        _count: { _all: true },
      })
    : [];
  const juradoIds = [...new Set(porJurado.map((p) => p.jurorId))];
  const perfiles = juradoIds.length
    ? await prisma.fotorankJudgeProfile.findMany({
        where: { judgeAccountId: { in: juradoIds } },
        select: { judgeAccountId: true, firstName: true, lastName: true },
      })
    : [];
  const nombreDe = new Map(perfiles.map((p) => [p.judgeAccountId, `${p.firstName} ${p.lastName}`]));
  const avance = juradoIds.map((id) => {
    const filas = porJurado.filter((p) => p.jurorId === id);
    const enviadas = filas
      .filter((f) => f.status === "SUBMITTED" || f.status === "LOCKED")
      .reduce((a, f) => a + f._count._all, 0);
    const empezadas = filas
      .filter((f) => f.status === "IN_PROGRESS")
      .reduce((a, f) => a + f._count._all, 0);
    return { id, nombre: nombreDe.get(id) ?? "Jurado", enviadas, empezadas };
  });

  const lote = sesion
    ? await db.fotorankResultBatch.findFirst({
        where: { contestId, scoringSessionId: sesion.id, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        include: {
          entries: {
            orderBy: [{ scopeKey: "asc" }, { preliminaryPosition: "asc" }],
            include: {
              juryEntrySnapshot: {
                select: { entry: { select: { clickatonParticipantNumber: true } } },
              },
            },
          },
        },
      })
    : null;

  const consignaIds = [
    ...new Set((lote?.entries ?? []).map((e) => e.promptExternalId).filter(Boolean) as string[]),
  ];
  const consignas = consignaIds.length
    ? await db.clickatonPrompt.findMany({
        where: { id: { in: consignaIds } },
        select: { id: true, sequence: true, title: true },
      })
    : [];
  const consignaDe = new Map(consignas.map((c) => [c.id, c]));
  const ambitos = [...new Set((lote?.entries ?? []).map((e) => e.scopeKey))].sort((a, b) => {
    const pa = (lote?.entries.find((e) => e.scopeKey === a)?.promptExternalId ?? "") as string;
    const pb = (lote?.entries.find((e) => e.scopeKey === b)?.promptExternalId ?? "") as string;
    return (consignaDe.get(pa)?.sequence ?? 999) - (consignaDe.get(pb)?.sequence ?? 999);
  });

  const cerrada = sesion?.status === "CLOSED" || sesion?.status === "LOCKED";
  const finalizado = lote?.status === "FINALIZED" || lote?.status === "PUBLISHED";

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <Link href="/super-admin/clickaton" className="text-sm text-gold hover:text-gold-hover">
          ← Conexión con Clickatón
        </Link>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">{concurso.title}</h1>
        <p className="text-sm text-fr-muted">Juzgamiento y ranking de la maratón.</p>
      </header>

      {aviso ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="status">
          {aviso}
        </p>
      ) : null}

      {!sesion ? (
        <p className="text-sm text-fr-muted">Esta maratón todavía no tiene el juzgamiento abierto.</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Evaluación</h2>
            <div className="fr-recuadro space-y-2 border border-fr-border bg-fr-card text-sm">
              <p>
                Estado: <b>{ESTADO_SESION[sesion.status] ?? sesion.status}</b>
              </p>
              {cobertura ? (
                <p className="text-fr-muted">
                  {cobertura.completeEntries} de {cobertura.totalEntries} obras tienen las{" "}
                  {cobertura.minimumPerEntry} calificaciones que piden las bases ·{" "}
                  {cobertura.submittedEvaluations} calificaciones enviadas
                  {cobertura.activeConflicts > 0 ? ` · ${cobertura.activeConflicts} conflictos abiertos` : ""}
                </p>
              ) : null}
            </div>
            {avance.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {avance.map((j) => (
                  <li key={j.id} className="rounded-lg border border-fr-border px-4 py-3 text-sm">
                    <span className="font-medium text-fr-primary">{j.nombre}</span>
                    <span className="block text-xs text-fr-muted">
                      {j.enviadas} enviadas · {j.empezadas} empezadas sin enviar
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fr-muted">Ningún jurado empezó a calificar todavía.</p>
            )}
            {!cerrada ? (
              <form action={cerrarEvaluacionAction} className="fr-recuadro space-y-3 border border-fr-border bg-fr-card">
                <input type="hidden" name="contestId" value={contestId} />
                <input type="hidden" name="sessionId" value={sesion.id} />
                <p className="text-sm text-fr-muted">
                  Al cerrar, los jurados ya no pueden calificar. Si faltan calificaciones, esas obras
                  quedan fuera del ranking.
                </p>
                <label className="flex items-center gap-2 text-sm text-fr-muted">
                  <input type="checkbox" name="forzar" value="1" /> Cerrar aunque haya obras incompletas
                </label>
                <input name="razon" placeholder="Motivo (obligatorio si cerrás con incompletas)" className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm" />
                <button type="submit" className="fr-btn fr-btn-primary">Cerrar la evaluación</button>
              </form>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Ranking</h2>
            {!cerrada ? (
              <p className="text-sm text-fr-muted">Se genera cuando la evaluación está cerrada.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {!finalizado ? (
                  <form action={generarRankingAction}>
                    <input type="hidden" name="contestId" value={contestId} />
                    <input type="hidden" name="sessionId" value={sesion.id} />
                    <button type="submit" className="fr-btn fr-btn-primary">
                      {lote ? "Volver a generar el ranking" : "Generar el ranking"}
                    </button>
                  </form>
                ) : null}
                {lote ? (
                  <span className="text-sm text-fr-muted">
                    Estado: <b className="text-fr-primary">{ESTADO_RANKING[lote.status] ?? lote.status}</b>
                  </span>
                ) : null}
              </div>
            )}

            {lote
              ? ambitos.map((ambito) => {
                  const filas = lote.entries.filter((e) => e.scopeKey === ambito);
                  const c = consignaDe.get(filas[0]?.promptExternalId ?? "");
                  return (
                    <div key={ambito} className="space-y-2">
                      <h3 className="text-base font-semibold text-fr-primary">
                        {c ? `Consigna ${c.sequence} — ${c.title}` : "Sin consigna"}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-fr-muted">
                            <tr>
                              <th className="py-2 pr-3">Puesto</th>
                              <th className="py-2 pr-3">Premio</th>
                              <th className="py-2 pr-3">Código</th>
                              <th className="py-2 pr-3">Participante</th>
                              <th className="py-2 pr-3">Nota</th>
                              <th className="py-2">Calificaciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map((e) => (
                              <tr key={e.id} className="border-t border-fr-border">
                                <td className="py-2 pr-3">
                                  {e.finalPosition ?? e.preliminaryPosition ?? "—"}
                                  {e.resultStatus === "TIED" ? " (empate)" : ""}
                                </td>
                                <td className="py-2 pr-3 text-gold">{e.awardType ? PREMIO[e.awardType] ?? e.awardType : ""}</td>
                                <td className="py-2 pr-3 font-mono">{e.anonymousCode}</td>
                                <td className="py-2 pr-3">
                                  {e.juryEntrySnapshot.entry.clickatonParticipantNumber ?? "—"}
                                </td>
                                <td className="py-2 pr-3">
                                  {e.aggregateScore != null ? e.aggregateScore.toFixed(2) : "—"}
                                </td>
                                <td className="py-2 text-fr-muted">
                                  {e.evaluationCount}
                                  {e.coverageStatus !== "COMPLETE" ? " (incompleta)" : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              : null}

            {lote && !finalizado ? (
              <form action={finalizarRankingAction} className="fr-recuadro space-y-3 border border-fr-border bg-fr-card">
                <input type="hidden" name="contestId" value={contestId} />
                <input type="hidden" name="batchId" value={lote.id} />
                <p className="text-sm text-fr-muted">
                  Finalizar congela el ranking: los diplomas y la publicación salen de acá.
                </p>
                <label className="flex items-center gap-2 text-sm text-fr-muted">
                  <input type="checkbox" name="forzar" value="1" /> Finalizar aunque haya pendientes
                </label>
                <input name="razon" placeholder="Motivo (obligatorio si finalizás con pendientes)" className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm" />
                <button type="submit" className="fr-btn fr-btn-primary">Finalizar el ranking</button>
              </form>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

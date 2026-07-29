// @ts-nocheck — P0 jury/scoring models not in deployed Prisma client yet
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../lib/fotorank/dashboard-org-context";
import { decorateRankedRow, getFotorankCategoryJudgeResults } from "../../../../../lib/fotorank/judgeResultsForCategory";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import {
  activateResultRuleSetAction,
  ensureResultRuleSetAction,
  finalizeResultBatchAction,
  generateResultBatchAction,
  reviewResultBatchAction,
} from "../../../../../lib/fotorank/results/result-actions";
import { exportBlindResultsCsv } from "../../../../../lib/fotorank/results/result-service";
import { PageContainer } from "../../../../../components/PageContainer";
import { PageInfoRecuadro } from "../../../../../components/ui/PageInfoRecuadro";
import { routes } from "../../../../../lib/routes";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}

export default async function ContestResultadosPage({ params, searchParams }: PageProps) {
  const { id: contestId } = await params;
  const { category: categoryIdParam } = await searchParams;

  const user = await requireAuth();
  const orgRes = await resolveActiveOrganizationForUser(user.id);
  if (!orgRes.ok) {
    return (
      <PageContainer title="Resultados" description="Ranking por categoría (votos de jurado).">
        <PageInfoRecuadro variant="warning">
          <p className="fr-body text-fr-muted">{orgRes.error}</p>
        </PageInfoRecuadro>
      </PageContainer>
    );
  }

  const contest = await getFotorankContestById(contestId);
  if (!contest || contest.organizationId !== orgRes.org.id) {
    notFound();
  }

  const closedSession = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId, status: { in: ["CLOSED", "LOCKED"] } },
    orderBy: { closedAt: "desc" },
    include: { rubric: { select: { name: true, version: true } } },
  });
  const ruleSet = closedSession
    ? await prisma.fotorankResultRuleSet.findFirst({
        where: { contestId, scoringSessionId: closedSession.id },
        orderBy: { version: "desc" },
      })
    : null;
  const resultBatch = await prisma.fotorankResultBatch.findFirst({
    where: {
      contestId,
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        orderBy: [{ scopeKey: "asc" }, { preliminaryPosition: "asc" }],
        take: 100,
      },
    },
  });
  const blindCsv =
    resultBatch != null ? await exportBlindResultsCsv(contestId, resultBatch.id) : null;

  const categories = contest.categories.filter((c) => c.status === "ACTIVE" || !c.status);
  const activeCategoryId =
    categoryIdParam && categories.some((c) => c.id === categoryIdParam)
      ? categoryIdParam
      : categories[0]?.id ?? null;

  const results = activeCategoryId
    ? await getFotorankCategoryJudgeResults({ contestId, categoryId: activeCategoryId })
    : null;

  return (
    <PageContainer
      title={`Resultados: ${contest.title}`}
      description="Etapa 15: ranking privado sobre sesión CLOSED. Sin publicación LIVE."
    >
      <div className="mb-10 flex flex-wrap gap-3">
        <Link href={routes.dashboard.concursos.detalle(contestId)} className="fr-btn fr-btn-secondary text-sm">
          Volver al concurso
        </Link>
        <Link href={`/dashboard/concursos/${contestId}/jurado`} className="fr-btn fr-btn-secondary text-sm">
          Panel jurado
        </Link>
      </div>

      <section className="fr-recuadro mb-12 space-y-4 border border-fr-border bg-fr-card">
        <h2 className="text-lg font-semibold text-fr-primary">Ranking Etapa 15 (privado)</h2>
        <p className="text-sm text-fr-muted leading-relaxed">
          Consume solo sesión CLOSED + evaluaciones SUBMITTED + snapshots FROZEN. Identidad oculta.
          No publica ni notifica ganadores.
        </p>
        <p className="text-sm">
          Sesión:{" "}
          {closedSession
            ? `${closedSession.status} · rúbrica ${closedSession.rubric.name} v${closedSession.rubric.version}`
            : "sin sesión CLOSED"}
        </p>
        <p className="text-sm">
          Ruleset:{" "}
          {ruleSet
            ? `${ruleSet.name} v${ruleSet.version} (${ruleSet.status}) · rankingEnabled=${ruleSet.rankingEnabled ? "sí" : "no"}`
            : "sin ruleset"}
        </p>
        <p className="text-sm">
          Batch:{" "}
          {resultBatch
            ? `${resultBatch.status} · ${resultBatch.entries.length} obras · engine ${resultBatch.engineVersion}`
            : "sin batch"}
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          {closedSession ? (
            <form action={ensureResultRuleSetAction.bind(null, contestId)}>
              <input type="hidden" name="scoringSessionId" value={closedSession.id} />
              <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                Crear ruleset DRAFT
              </button>
            </form>
          ) : null}
          {ruleSet ? (
            <form action={activateResultRuleSetAction.bind(null, contestId)}>
              <input type="hidden" name="ruleSetId" value={ruleSet.id} />
              <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                Activar ruleset
              </button>
            </form>
          ) : null}
          {closedSession && ruleSet ? (
            <form action={generateResultBatchAction.bind(null, contestId)}>
              <input type="hidden" name="scoringSessionId" value={closedSession.id} />
              <input type="hidden" name="ruleSetId" value={ruleSet.id} />
              <button type="submit" className="fr-btn fr-btn-primary min-h-11 px-5 text-sm">
                Generar / regenerar batch
              </button>
            </form>
          ) : null}
          {resultBatch && resultBatch.status !== "FINALIZED" && resultBatch.status !== "PUBLISHED" ? (
            <>
              <form action={reviewResultBatchAction.bind(null, contestId)}>
                <input type="hidden" name="batchId" value={resultBatch.id} />
                <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                  Marcar revisado
                </button>
              </form>
              <form action={finalizeResultBatchAction.bind(null, contestId)} className="flex flex-wrap gap-2">
                <input type="hidden" name="batchId" value={resultBatch.id} />
                <input name="reason" placeholder="Motivo (opc.)" className="fr-filter-input" />
                <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                  Finalizar (inmutable)
                </button>
              </form>
            </>
          ) : null}
        </div>

        {resultBatch && resultBatch.entries.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-xl border border-fr-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-fr-border bg-fr-bg text-fr-muted">
                  <th className="px-4 py-3 font-semibold">Pos</th>
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Ámbito</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Cobertura</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Premio</th>
                </tr>
              </thead>
              <tbody>
                {resultBatch.entries.map((e) => (
                  <tr key={e.id} className="border-b border-fr-border/80">
                    <td className="px-4 py-3 text-fr-muted">
                      {e.finalPosition ?? e.preliminaryPosition ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-fr-primary">{e.anonymousCode}</td>
                    <td className="px-4 py-3 text-fr-muted font-mono text-xs">{e.scopeKey}</td>
                    <td className="px-4 py-3 font-mono text-gold">
                      {e.aggregateScore != null ? e.aggregateScore.toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-3 text-fr-muted">{e.coverageStatus}</td>
                    <td className="px-4 py-3 text-fr-muted">{e.resultStatus}</td>
                    <td className="px-4 py-3 text-fr-muted">{e.awardType ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {blindCsv ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gold">Export ciego (CSV preview)</summary>
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-fr-bg p-4 text-xs text-fr-muted">
              {blindCsv}
            </pre>
          </details>
        ) : null}
      </section>

      <h2 className="mb-6 text-lg font-semibold text-fr-primary">Legado JudgeVote (referencia)</h2>
      <p className="mb-8 text-sm text-fr-muted leading-relaxed">
        Ranking histórico por votos. No es fuente de verdad Etapa 15.
      </p>

      {categories.length === 0 ? (
        <PageInfoRecuadro>
          <p className="fr-body text-fr-muted">
            Este concurso no tiene categorías. Agregá categorías para ver resultados.
          </p>
        </PageInfoRecuadro>
      ) : (
        <>
          <nav className="mb-10 flex flex-wrap gap-2 border-b border-fr-border pb-6" aria-label="Categorías">
            {categories.map((cat) => {
              const active = cat.id === activeCategoryId;
              return (
                <Link
                  key={cat.id}
                  href={`${routes.dashboard.concursos.resultados(contestId)}?category=${encodeURIComponent(cat.id)}`}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-gold/15 text-gold ring-1 ring-gold/40"
                      : "bg-fr-card text-fr-muted hover:text-fr-primary ring-1 ring-fr-border"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </nav>

          {results && !results.ok && results.code === "AMBIGUOUS_METHOD" ? (
            <PageInfoRecuadro variant="danger" density="compact">
              <p className="text-sm font-semibold leading-snug text-red-200">{results.message}</p>
              <p className="fr-body-small text-fr-muted">
                Métodos detectados:{" "}
                <span className="font-mono text-fr-primary">{results.methodTypesFound.join(", ")}</span>
              </p>
            </PageInfoRecuadro>
          ) : null}

          {results && results.ok && results.variant === "NO_ASSIGNMENTS" ? (
            <PageInfoRecuadro variant="warningSoft" className="mb-10">
              <p className="fr-body text-fr-muted">{results.message}</p>
            </PageInfoRecuadro>
          ) : null}

          {results && results.ok && results.variant === "READY" ? (
            <PageInfoRecuadro density="compact" className="mb-10">
              <p className="text-sm leading-relaxed text-fr-primary">
                <span className="text-fr-muted">Método:</span>{" "}
                <span className="font-mono text-gold">{results.methodType}</span>
              </p>
              <p className="text-sm leading-relaxed text-fr-muted">
                <span className="font-medium text-fr-primary">Agregación:</span> {results.aggregationLabel}
              </p>
              <p className="text-sm leading-relaxed text-fr-muted">
                <span className="font-medium text-fr-primary">Orden:</span> {results.sortHelp}
              </p>
              <p className="fr-caption">Asignaciones en esta categoría: {results.assignmentCount}</p>
            </PageInfoRecuadro>
          ) : null}

          {results && results.ok ? (
            <div className="overflow-x-auto rounded-xl border border-[#262626] bg-[#0a0a0a]">
              <table
                data-testid="fotorank-results-table"
                className="w-full min-w-[640px] border-collapse text-left text-sm"
              >
                <thead>
                  <tr className="border-b border-fr-border bg-[#141414] text-fr-muted">
                    <th className="fr-recuadro py-4 font-semibold">#</th>
                    <th className="fr-recuadro py-4 font-semibold">Obra</th>
                    <th className="fr-recuadro py-4 font-semibold">Valor agregado</th>
                    <th className="fr-recuadro py-4 font-semibold">Votos</th>
                  </tr>
                </thead>
                <tbody>
                  {results.ranked.map((row) => {
                    const decorated =
                      results.variant === "READY"
                        ? decorateRankedRow(results.methodType, row)
                        : { ...row, displayValue: "—" };
                    return (
                      <tr key={row.entryId} className="border-b border-fr-border/80 hover:bg-fr-card/40">
                        <td className="fr-recuadro py-4 align-middle text-fr-muted">{decorated.rankPosition}</td>
                        <td className="fr-recuadro py-4 align-middle">
                          <div className="flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={decorated.imageUrl}
                              alt=""
                              className="h-14 w-20 shrink-0 rounded-md border border-fr-border object-cover"
                            />
                            <span className="font-medium text-fr-primary">{decorated.title ?? "Sin título"}</span>
                          </div>
                        </td>
                        <td className="fr-recuadro py-4 align-middle font-mono text-gold">{decorated.displayValue}</td>
                        <td className="fr-recuadro py-4 align-middle text-fr-muted">{decorated.voteCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}

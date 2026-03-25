import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../lib/fotorank/dashboard-org-context";
import { decorateRankedRow, getFotorankCategoryJudgeResults } from "../../../../../lib/fotorank/judgeResultsForCategory";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import { PageContainer } from "../../../../../components/PageContainer";
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
        <div className="fr-recuadro rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-fr-muted">
          {orgRes.error}
        </div>
      </PageContainer>
    );
  }

  const contest = await getFotorankContestById(contestId);
  if (!contest || contest.organizationId !== orgRes.org.id) {
    notFound();
  }

  const categories = contest.categories;
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
      description="Agregación de votos de jurado por categoría (FotorankContestEntry + FotorankJudgeVote)."
    >
      <div className="mb-10 flex flex-wrap gap-3">
        <Link href={routes.dashboard.concursos.detalle(contestId)} className="fr-btn fr-btn-secondary text-sm">
          Volver al concurso
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="fr-recuadro rounded-xl border border-[#262626] bg-[#141414]">
          <p className="text-sm text-fr-muted">Este concurso no tiene categorías. Agregá categorías para ver resultados.</p>
        </div>
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
            <div className="fr-recuadro rounded-xl border border-red-500/30 bg-red-500/5">
              <p className="text-sm font-semibold text-red-200">{results.message}</p>
              <p className="mt-4 text-sm text-fr-muted">
                Métodos detectados:{" "}
                <span className="font-mono text-fr-primary">{results.methodTypesFound.join(", ")}</span>
              </p>
            </div>
          ) : null}

          {results && results.ok && results.variant === "NO_ASSIGNMENTS" ? (
            <div className="fr-recuadro mb-10 rounded-xl border border-amber-500/25 bg-amber-500/5">
              <p className="text-sm text-fr-muted">{results.message}</p>
            </div>
          ) : null}

          {results && results.ok && results.variant === "READY" ? (
            <div className="fr-recuadro mb-10 space-y-3 rounded-xl border border-[#262626] bg-[#141414]">
              <p className="text-sm text-fr-primary">
                <span className="text-fr-muted">Método:</span>{" "}
                <span className="font-mono text-gold">{results.methodType}</span>
              </p>
              <p className="text-sm text-fr-muted">
                <span className="font-medium text-fr-primary">Agregación:</span> {results.aggregationLabel}
              </p>
              <p className="text-sm text-fr-muted">
                <span className="font-medium text-fr-primary">Orden:</span> {results.sortHelp}
              </p>
              <p className="text-xs text-fr-muted-soft">
                Asignaciones en esta categoría: {results.assignmentCount}
              </p>
            </div>
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

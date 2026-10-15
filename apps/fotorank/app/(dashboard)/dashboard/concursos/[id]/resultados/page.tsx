import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../lib/fotorank/dashboard-org-context";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import {
  activateResultRuleSetAction,
  ensureResultRuleSetAction,
  finalizeResultBatchAction,
  generateResultBatchAction,
  reviewResultBatchAction,
} from "../../../../../lib/fotorank/results/result-actions";
import { exportBlindResultsCsv } from "../../../../../lib/fotorank/results/result-service";
import { evaluateResultPublicationReadiness } from "../../../../../lib/fotorank/results/publication-readiness";
import { ensurePublicationMeta } from "../../../../../lib/fotorank/results/publication-service";
import { PageContainer } from "../../../../../components/PageContainer";
import { PageInfoRecuadro } from "../../../../../components/ui/PageInfoRecuadro";
import { routes } from "../../../../../lib/routes";
import { armarMuestraUrl } from "../../../../../lib/fotorank/external/muestras";
import { PublicationGatesPanel } from "./PublicationGatesPanel";

export const dynamic = "force-dynamic";

/** Roles de la organización que pueden llevar los resultados a una muestra (etapa 7 de Muestras). */
const ROLES_QUE_ARMAN_MUESTRA = ["OWNER", "ADMIN", "EDITOR"] as const;

/**
 * Recuadro "Armar muestra": sólo para quien organiza (OWNER/ADMIN/EDITOR activo de la organización
 * del concurso) o super admin, y nunca en maratones. `LISTO` con un lote FINALIZED o PUBLISHED;
 * `ESPERA` sin lote cerrado. Sólo lectura: ante cualquier error, no se muestra nada.
 */
async function estadoArmarMuestra(
  contest: { id: string; organizationId: string; experienceType: string; distributionChannel: string | null },
  user: { id: number; globalRole?: string | null; role?: string | null },
): Promise<"LISTO" | "ESPERA" | null> {
  try {
    if (contest.experienceType === "MARATHON" || contest.distributionChannel === "CLICKATON") return null;
    const superAdmin = user.globalRole === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
    if (!superAdmin) {
      const miembro = await prisma.contestOrganizationMember.count({
        where: { organizationId: contest.organizationId, userId: user.id, status: "ACTIVE", role: { in: [...ROLES_QUE_ARMAN_MUESTRA] } },
      });
      if (miembro === 0) return null;
    }
    const lote = await prisma.fotorankResultBatch.findFirst({
      where: { contestId: contest.id, status: { in: ["FINALIZED", "PUBLISHED"] } },
      select: { id: true },
    });
    return lote ? "LISTO" : "ESPERA";
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}

export default async function ContestResultadosPage({ params }: PageProps) {
  const { id: contestId } = await params;

  const user = await requireAuth();
  const contest = await getFotorankContestById(contestId);
  if (!contest) notFound();

  const orgRes = await resolveActiveOrganizationForUser(user.id);
  // Super Admin puede abrir el concurso aunque el selector apunte a otra org.
  const orgMismatch =
    orgRes.ok &&
    contest.organizationId !== orgRes.org.id &&
    user.globalRole !== "SUPER_ADMIN" &&
    user.role !== "SUPER_ADMIN";
  if (!orgRes.ok && user.globalRole !== "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
    return (
      <PageContainer title="Resultados" description="Ranking por categoría (votos de jurado).">
        <PageInfoRecuadro variant="warning">
          <p className="fr-body text-fr-muted">{orgRes.error}</p>
        </PageInfoRecuadro>
      </PageContainer>
    );
  }
  if (orgMismatch) {
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

  if (resultBatch) {
    await ensurePublicationMeta({
      contestId,
      batchId: resultBatch.id,
      actorUserId: user.id,
    });
  }
  const readiness = resultBatch
    ? await evaluateResultPublicationReadiness({ contestId, batchId: resultBatch.id })
    : null;

  const armarMuestra = await estadoArmarMuestra(contest, user);

  // El "Legado JudgeVote" que se mostraba acá leía los votos del método viejo,
  // que ya no escribe nadie. Se quitó el 2026-09-25.

  return (
    <PageContainer
      title={`Resultados: ${contest.title}`}
      description="Ranking del jurado con los criterios del concurso. Se genera con la evaluación cerrada."
    >
      <div className="mb-10 flex flex-wrap gap-3">
        <Link href={routes.dashboard.concursos.detalle(contestId)} className="fr-btn fr-btn-secondary text-sm">
          Volver al concurso
        </Link>
        <Link href={`/dashboard/concursos/${contestId}/jurado`} className="fr-btn fr-btn-secondary text-sm">
          Panel jurado
        </Link>
      </div>

      {armarMuestra ? (
        <div className="mb-10">
          <PageInfoRecuadro>
            <h2 className="text-lg font-semibold text-fr-primary">Llevá los ganadores a una muestra</h2>
            {armarMuestra === "LISTO" ? (
              <>
                <p className="fr-body text-fr-muted">
                  Armá en Muestras Fotográficas una muestra con las obras ganadoras y preseleccionadas: te llega un borrador con las
                  imágenes, los autores y los premios.
                </p>
                <div>
                  <a href={armarMuestraUrl(contest.id)} className="fr-btn fr-btn-primary" target="_blank" rel="noopener noreferrer">
                    Armar muestra
                  </a>
                </div>
              </>
            ) : (
              <p className="fr-body text-fr-muted">Cuando el jurado cierre los resultados vas a poder armar una muestra con las obras.</p>
            )}
          </PageInfoRecuadro>
        </div>
      ) : null}

      {resultBatch && readiness ? (
        <PublicationGatesPanel
          contestId={contestId}
          batchId={resultBatch.id}
          readiness={readiness}
        />
      ) : null}

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

    </PageContainer>
  );
}

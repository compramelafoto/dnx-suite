import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageContainer } from "../../../../../components/PageContainer";
import { requireAuth } from "../../../../../lib/auth";
import { RegistrationError, assertOrganizerCanAccessContest } from "../../../../../lib/fotorank/registration";
import { getContestOperationalMetrics } from "../../../../../lib/fotorank/metrics/contest-metrics";
import { ScoringSessionPanel } from "./ScoringSessionPanel";
import { ConflictReassignPanel } from "./ConflictReassignPanel";
import { JuryPlanningPanel } from "../../../../../components/dashboard/jury/JuryPlanningPanel";
import { JuryProvisionalRankingBanner } from "../../../../../components/dashboard/jury/JuryProvisionalRankingBanner";
import { JuryCloseFinalistsPanel } from "../../../../../components/dashboard/jury/JuryCloseFinalistsPanel";
import { FinalistsPublicPrepPanel } from "../../../../../components/dashboard/jury/FinalistsPublicPrepPanel";
import { PublicVoteMonitorPanel } from "../../../../../components/dashboard/jury/PublicVoteMonitorPanel";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ closeError?: string }>;
};

export default async function ContestJuradoOpsPage({ params, searchParams }: Props) {
  const user = await requireAuth();
  const { id: contestId } = await params;
  const sp = (await searchParams) ?? {};

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError && err.code === "FORBIDDEN") redirect("/dashboard");
    if (err instanceof RegistrationError && err.code === "CONTEST_NOT_FOUND") notFound();
    throw err;
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { title: true, slug: true },
  });
  if (!contest) notFound();

  const metrics = await getContestOperationalMetrics(contestId);

  const frozenBatches = await prisma.fotorankAdmissionBatch.findMany({
    where: { contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
    take: 5,
    select: { id: true, frozenAt: true, frozenEntries: true },
  });

  const scoringSession = await prisma.fotorankJuryScoringSession.findFirst({
    where: {
      contestId,
      status: { in: ["DRAFT", "READY", "OPEN", "PAUSED", "REVIEW_REQUIRED", "CLOSED", "LOCKED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      rubric: { include: { criteria: { select: { id: true } } } },
    },
  });
  const ruleSet = scoringSession
    ? await prisma.fotorankResultRuleSet.findFirst({
        where: { contestId, scoringSessionId: scoringSession.id },
        orderBy: { version: "desc" },
        select: { id: true },
      })
    : null;
  const resultBatch = await prisma.fotorankResultBatch.findFirst({
    where: { contestId, status: { notIn: ["CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const assignments = await prisma.fotorankJudgeAssignment.findMany({
    where: { contestId },
    include: {
      judgeAccount: { include: { profile: true } },
      category: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const invitations = await prisma.fotorankJudgeInvitation.findMany({
    where: { contestId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      invitationStatus: true,
      createdAt: true,
      expiresAt: true,
      categoryId: true,
    },
  });

  const conflicts = await prisma.fotorankJudgeEntryConflict.findMany({
    where: { contestId, status: "ACTIVE" },
    include: {
      entry: { select: { entryNumber: true, categoryId: true } },
      judgeAccount: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { declaredAt: "desc" },
  });

  const confirmedByCategory = await prisma.fotorankContestEntry.groupBy({
    by: ["categoryId"],
    where: { contestId, status: "CONFIRMED", withdrawnAt: null },
    _count: { _all: true },
  });
  const catCount = new Map(confirmedByCategory.map((c) => [c.categoryId, c._count._all]));

  const backupJudges = assignments
    .filter((a) => a.assignmentStatus === "ACCEPTED" || a.assignmentType === "BACKUP")
    .map((a) => ({
      id: a.judgeAccountId,
      label: a.judgeAccount.profile
        ? `${a.judgeAccount.profile.firstName} ${a.judgeAccount.profile.lastName}`.trim()
        : a.judgeAccount.email,
    }));
  const uniqueBackups = [...new Map(backupJudges.map((j) => [j.id, j])).values()];

  return (
    <PageContainer
      title={`Jurado: ${contest.title}`}
      description="Estado operativo de invitaciones, asignaciones y conflictos (sin tokens)."
    >
      <div className="mb-8">
        <Link href={`/dashboard/concursos/${contestId}`} className="text-sm text-gold hover:text-gold-hover">
          ← Volver al concurso
        </Link>
      </div>

      {sp.closeError ? (
        <p
          className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100"
          data-testid="scoring-close-error"
        >
          Cierre bloqueado: {sp.closeError}. Completá cobertura y resolvé conflictos antes de
          cerrar (sin force).
        </p>
      ) : null}

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/jurados/invitaciones" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
          Gestionar invitaciones
        </Link>
        <Link href="/jurados/asignaciones" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
          Asignaciones
        </Link>
        <Link
          href={`/dashboard/concursos/${contestId}/resultados`}
          className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
        >
          Ranking privado
        </Link>
        <Link
          href={`/dashboard/concursos/${contestId}/admision`}
          className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
        >
          Admisión / freeze
        </Link>
      </div>

      <ScoringSessionPanel
        contestId={contestId}
        frozenBatches={frozenBatches}
        session={
          scoringSession
            ? {
                id: scoringSession.id,
                status: scoringSession.status,
                scoringEnabled: scoringSession.scoringEnabled,
                minimumEvaluationsPerEntry: scoringSession.minimumEvaluationsPerEntry,
                admissionBatchId: scoringSession.admissionBatchId,
                rubricId: scoringSession.rubricId,
                openedAt: scoringSession.openedAt,
                closedAt: scoringSession.closedAt,
              }
            : null
        }
        rubric={
          scoringSession?.rubric
            ? {
                id: scoringSession.rubric.id,
                name: scoringSession.rubric.name,
                status: scoringSession.rubric.status,
                version: scoringSession.rubric.version,
                criteriaCount: scoringSession.rubric.criteria.length,
              }
            : null
        }
        resultBatchId={resultBatch?.id ?? null}
        ruleSetId={ruleSet?.id ?? null}
      />

      <div className="mb-10">
        <JuryPlanningPanel contestId={contestId} />
      </div>

      <div className="mb-10">
        <JuryProvisionalRankingBanner contestId={contestId} />
      </div>

      <div className="mb-10">
        <JuryCloseFinalistsPanel contestId={contestId} />
      </div>

      <div className="mb-10">
        <FinalistsPublicPrepPanel contestId={contestId} />
      </div>

      <div className="mb-10">
        <PublicVoteMonitorPanel contestId={contestId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Invitados", metrics.juryInvitedCount],
          ["Aceptados", metrics.juryAcceptedCount],
          ["Obras confirmadas", metrics.entriesConfirmedCount],
          ["Conflictos activos", conflicts.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="text-xs uppercase tracking-wide text-fr-muted">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-fr-primary">{value}</p>
          </div>
        ))}
      </div>

      <section className="fr-recuadro mt-10 border border-fr-border bg-fr-card overflow-x-auto">
        <h2 className="mb-6 text-lg font-semibold">Asignaciones</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-fr-border text-fr-muted">
            <tr>
              <th className="px-3 py-3">Jurado</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Obras disponibles</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b border-fr-border/50">
                <td className="px-3 py-3">
                  {a.judgeAccount.profile
                    ? `${a.judgeAccount.profile.firstName} ${a.judgeAccount.profile.lastName}`
                    : a.judgeAccount.email}
                </td>
                <td className="px-3 py-3">{a.category.name}</td>
                <td className="px-3 py-3">{a.assignmentStatus}</td>
                <td className="px-3 py-3">{catCount.get(a.categoryId) ?? 0}</td>
              </tr>
            ))}
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-fr-muted">
                  Sin asignaciones.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="fr-recuadro mt-10 border border-fr-border bg-fr-card overflow-x-auto">
        <h2 className="mb-6 text-lg font-semibold">Invitaciones</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-fr-border text-fr-muted">
            <tr>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Expira</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-fr-border/50">
                <td className="px-3 py-3">{inv.email}</td>
                <td className="px-3 py-3">{inv.invitationStatus}</td>
                <td className="px-3 py-3 text-xs text-fr-muted">{inv.expiresAt.toISOString()}</td>
              </tr>
            ))}
            {invitations.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-fr-muted">
                  Sin invitaciones.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="fr-recuadro mt-10 border border-fr-border bg-fr-card space-y-4">
        <h2 className="text-lg font-semibold">Conflictos declarados</h2>
        <ConflictReassignPanel
          contestId={contestId}
          conflicts={conflicts.map((c) => ({
            id: c.id,
            entryLabel: c.entry.entryNumber ?? c.id.slice(0, 8),
            judgeLabel: c.judgeAccount.profile
              ? `${c.judgeAccount.profile.firstName} ${c.judgeAccount.profile.lastName}`.trim()
              : "jurado",
            reasonCode: c.reasonCode,
          }))}
          backupJudges={uniqueBackups}
        />
      </section>
    </PageContainer>
  );
}

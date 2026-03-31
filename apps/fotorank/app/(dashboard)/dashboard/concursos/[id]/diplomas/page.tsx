import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../lib/fotorank/dashboard-org-context";
import { prisma } from "@repo/db";
import { PageContainer } from "../../../../../components/PageContainer";
import { routes } from "../../../../../lib/routes";
import { ensureDefaultDiplomaTemplateAction } from "../../../../../actions/diplomas";
import { DiplomasContestPanel } from "./DiplomasContestPanel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestDiplomasPage({ params }: PageProps) {
  const { id: contestId } = await params;
  const user = await requireAuth();
  const orgRes = await resolveActiveOrganizationForUser(user.id);
  if (!orgRes.ok) {
    return (
      <PageContainer title="Diplomas" description="Emisión y validación.">
        <p className="text-sm text-fr-muted">{orgRes.error}</p>
      </PageContainer>
    );
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: orgRes.org.id },
    select: { id: true, title: true, slug: true },
  });
  if (!contest) notFound();

  await ensureDefaultDiplomaTemplateAction(contest.id);

  const templates = await prisma.fotorankDiplomaTemplate.findMany({
    where: { contestId: contest.id, organizationId: orgRes.org.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      layoutJson: true,
      widthPt: true,
      heightPt: true,
      backgroundColor: true,
      backgroundImageUrl: true,
    },
  });

  const categories = await prisma.fotorankContestCategory.findMany({
    where: { contestId: contest.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const rawEntries = await prisma.fotorankContestEntry.findMany({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    take: 800,
    select: {
      id: true,
      title: true,
      category: { select: { id: true, name: true } },
    },
  });

  const entries = rawEntries.map((e) => ({
    id: e.id,
    title: e.title,
    categoryName: e.category.name,
  }));

  const assignments = await prisma.fotorankJudgeAssignment.findMany({
    where: { contestId: contest.id },
    include: {
      judgeAccount: {
        include: { profile: true },
      },
    },
  });
  const seenJudge = new Set<string>();
  const judges: { id: string; label: string }[] = [];
  for (const a of assignments) {
    if (seenJudge.has(a.judgeAccountId)) continue;
    seenJudge.add(a.judgeAccountId);
    const ja = a.judgeAccount;
    const label =
      `${ja.profile?.firstName ?? ""} ${ja.profile?.lastName ?? ""}`.trim() || ja.email;
    judges.push({ id: ja.id, label });
  }

  const authorRows = await prisma.fotorankContestEntry.findMany({
    where: { contestId: contest.id, authorUserId: { not: null } },
    select: {
      authorUserId: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });
  const participantMap = new Map<number, { userId: number; label: string }>();
  for (const r of authorRows) {
    if (r.authorUserId == null || !r.author) continue;
    if (!participantMap.has(r.authorUserId)) {
      participantMap.set(r.authorUserId, {
        userId: r.authorUserId,
        label: r.author.name?.trim() || r.author.email,
      });
    }
  }
  const participants = [...participantMap.values()];

  const initialIssued = await prisma.fotorankDiplomaIssued.findMany({
    where: { contestId: contest.id, organizationId: orgRes.org.id },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      recipientType: true,
      recipientName: true,
      status: true,
      diplomaCode: true,
      verificationUrl: true,
      pdfUrl: true,
      pngUrl: true,
      renderedAt: true,
      createdAt: true,
      prizeLabel: true,
      failureReason: true,
      supersededById: true,
    },
  });

  return (
    <PageContainer
      title={`Diplomas — ${contest.title}`}
      description="Plantillas, emisión y verificación."
    >
      <div className="mb-8 flex justify-center sm:mb-10 sm:justify-start">
        <Link href={routes.dashboard.concursos.detalle(contestId)} className="fr-btn fr-btn-secondary text-sm">
          Volver al concurso
        </Link>
      </div>

      <DiplomasContestPanel
        contestId={contest.id}
        contestTitle={contest.title}
        categories={categories}
        templates={templates}
        entries={entries}
        judges={judges}
        participants={participants}
        initialIssued={initialIssued}
      />
    </PageContainer>
  );
}

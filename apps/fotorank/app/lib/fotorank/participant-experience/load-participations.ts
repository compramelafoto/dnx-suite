import { prisma } from "@repo/db";
import { buildParticipantParticipationView } from "./build-view";
import type { ParticipantParticipationView } from "./types";

type EntryRow = {
  id: string;
  registrationId: string | null;
  status: string;
  entryNumber: string | null;
  technicalSummaryStatus: string | null;
  manualReviewStatus: string | null;
  admissionStatus: string | null;
  publicRejectionReason: string | null;
};

function mapEntry(e: EntryRow | undefined) {
  if (!e) return null;
  return {
    id: e.id,
    status: e.status,
    entryNumber: e.entryNumber,
    technicalSummaryStatus: e.technicalSummaryStatus,
    manualReviewStatus: e.manualReviewStatus,
    admissionStatus: e.admissionStatus,
    publicRejectionReason: e.publicRejectionReason,
  };
}

/**
 * Listado de participaciones del usuario autenticado.
 * Ownership: where participantUserId.
 */
export async function listMyParticipationViews(
  participantUserId: number,
  now = new Date(),
): Promise<ParticipantParticipationView[]> {
  const rows = await prisma.fotorankContestRegistration.findMany({
    where: { participantUserId },
    orderBy: { createdAt: "desc" },
    include: {
      contest: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          timezone: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
          submissionOpensAt: true,
          submissionDeadline: true,
          startAt: true,
          judgingStartAt: true,
          judgingEndAt: true,
          resultsAt: true,
        },
      },
      category: {
        select: { id: true, name: true, slug: true, maxFiles: true },
      },
    },
  });

  if (rows.length === 0) return [];

  const entries = await prisma.fotorankContestEntry.findMany({
    where: { registrationId: { in: rows.map((r) => r.id) } },
    select: {
      id: true,
      registrationId: true,
      status: true,
      entryNumber: true,
      technicalSummaryStatus: true,
      manualReviewStatus: true,
      admissionStatus: true,
      publicRejectionReason: true,
    },
  });
  const entryByReg = new Map(entries.map((e) => [e.registrationId!, e]));

  const contestIds = [...new Set(rows.map((r) => r.contestId))];
  const publishedBatches = await prisma.fotorankResultBatch.findMany({
    where: { contestId: { in: contestIds }, status: "PUBLISHED" },
    select: { contestId: true },
  });
  const publishedSet = new Set(publishedBatches.map((b) => b.contestId));
  const publishedRules = await prisma.fotorankContestRulesVersion.findMany({
    where: { contestId: { in: contestIds }, status: "PUBLISHED" },
    select: { contestId: true, id: true, versionNumber: true },
    orderBy: { versionNumber: "desc" },
  });
  const currentRulesByContest = new Map<string, string>();
  for (const rv of publishedRules) {
    if (!currentRulesByContest.has(rv.contestId)) {
      currentRulesByContest.set(rv.contestId, rv.id);
    }
  }

  return rows.map((r) =>
    buildParticipantParticipationView({
      id: r.id,
      contestId: r.contestId,
      contestTitle: r.contest.title,
      contestSlug: r.contest.slug,
      registrationNumber: r.registrationNumber,
      categoryId: r.category.id,
      categoryName: r.category.name,
      categorySlug: r.category.slug,
      maxFiles: r.category.maxFiles,
      registrationStatus: r.status,
      paymentStatus: r.paymentStatus,
      registeredAt: r.registeredAt,
      confirmedAt: r.confirmedAt,
      entry: mapEntry(entryByReg.get(r.id)),
      acceptedRulesVersionId: r.rulesVersionId,
      currentRulesVersionId: currentRulesByContest.get(r.contestId) ?? null,
      contest: {
        ...r.contest,
        timezone: r.contest.timezone ?? null,
      },
      resultsPublished: publishedSet.has(r.contestId),
      now,
    }),
  );
}

/**
 * Detalle de una participación propia.
 * Si no pertenece al usuario o no existe → null (caller usa notFound sin filtrar existencia).
 */
export async function getMyParticipationView(
  participantUserId: number,
  registrationId: string,
  now = new Date(),
): Promise<ParticipantParticipationView | null> {
  const r = await prisma.fotorankContestRegistration.findFirst({
    where: { id: registrationId, participantUserId },
    include: {
      contest: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          timezone: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
          submissionOpensAt: true,
          submissionDeadline: true,
          startAt: true,
          judgingStartAt: true,
          judgingEndAt: true,
          resultsAt: true,
        },
      },
      category: {
        select: { id: true, name: true, slug: true, maxFiles: true },
      },
    },
  });
  if (!r) return null;

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { registrationId: r.id },
    select: {
      id: true,
      registrationId: true,
      status: true,
      entryNumber: true,
      technicalSummaryStatus: true,
      manualReviewStatus: true,
      admissionStatus: true,
      publicRejectionReason: true,
    },
  });

  const published = await prisma.fotorankResultBatch.findFirst({
    where: { contestId: r.contestId, status: "PUBLISHED" },
    select: { id: true },
  });

  const currentRules = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: r.contestId, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
    select: { id: true },
  });

  return buildParticipantParticipationView({
    id: r.id,
    contestId: r.contestId,
    contestTitle: r.contest.title,
    contestSlug: r.contest.slug,
    registrationNumber: r.registrationNumber,
    categoryId: r.category.id,
    categoryName: r.category.name,
    categorySlug: r.category.slug,
    maxFiles: r.category.maxFiles,
    registrationStatus: r.status,
    paymentStatus: r.paymentStatus,
    registeredAt: r.registeredAt,
    confirmedAt: r.confirmedAt,
    entry: mapEntry(entry ?? undefined),
    acceptedRulesVersionId: r.rulesVersionId,
    currentRulesVersionId: currentRules?.id ?? null,
    contest: {
      ...r.contest,
      timezone: r.contest.timezone ?? null,
    },
    resultsPublished: Boolean(published),
    now,
    surface: "detail",
  });
}

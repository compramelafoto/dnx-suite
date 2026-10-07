import { prisma } from "@repo/db";
import { isEmptyDraftEntry, resolveCategoryEntryLimits } from "../entries/entry-quota";
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
  assets: Array<{ id: string }>;
};

const ENTRY_SELECT = {
  id: true,
  registrationId: true,
  status: true,
  entryNumber: true,
  technicalSummaryStatus: true,
  manualReviewStatus: true,
  admissionStatus: true,
  publicRejectionReason: true,
  assets: { where: { kind: "ORIGINAL" as const }, select: { id: true }, take: 1 },
};

/**
 * La política se lee sólo para el cupo. No se pasa a la ventana de carga: esta
 * vista nunca la leyó, y sumarle el flag `publicUploadOpen` acá cambiaría lo que
 * ven los participantes de otros concursos sin que nadie lo haya pedido.
 */
function withoutUploadPolicy<T extends { uploadPolicyJson: unknown; categories: unknown }>(
  contest: T,
): Omit<T, "uploadPolicyJson" | "categories"> {
  const rest: Omit<T, "uploadPolicyJson" | "categories"> & { uploadPolicyJson?: unknown; categories?: unknown } = {
    ...contest,
  };
  delete rest.uploadPolicyJson;
  delete rest.categories;
  return rest;
}

/**
 * Cuántas obras puede presentar la inscripción en total: la suma de los cupos
 * de cada categoría habilitada (una sola, salvo que el concurso permita varias).
 */
function totalEntryLimit(r: {
  categoryId: string;
  purchasedEntriesCount: number | null;
  category: { id: string; name: string; slug: string; maxFiles: number };
  contest: { uploadPolicyJson: unknown; categories: Array<{ id: string; name: string; slug: string; maxFiles: number }> };
}): number {
  const categories = r.contest.categories.some((c) => c.id === r.categoryId)
    ? r.contest.categories
    : [r.category, ...r.contest.categories];
  return resolveCategoryEntryLimits({
    uploadPolicyJson: r.contest.uploadPolicyJson,
    registrationCategoryId: r.categoryId,
    categories,
    purchasedEntriesCount: r.purchasedEntriesCount,
  }).reduce((sum, c) => sum + c.limit, 0);
}

/** Obras reales de la inscripción: sin los borradores de intentos fallidos. */
function realEntries(entries: EntryRow[]): EntryRow[] {
  return entries.filter((e) => !isEmptyDraftEntry({ status: e.status, hasOriginal: e.assets.length > 0 }));
}

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
          uploadPolicyJson: true,
          categories: {
            where: { status: "ACTIVE" },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, slug: true, maxFiles: true },
          },
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
    orderBy: { createdAt: "asc" },
    select: ENTRY_SELECT,
  });
  const entriesByReg = new Map<string, EntryRow[]>();
  for (const e of realEntries(entries)) {
    const list = entriesByReg.get(e.registrationId!) ?? [];
    list.push(e);
    entriesByReg.set(e.registrationId!, list);
  }

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
      maxFiles: totalEntryLimit(r),
      registrationStatus: r.status,
      paymentStatus: r.paymentStatus,
      registeredAt: r.registeredAt,
      confirmedAt: r.confirmedAt,
      entry: mapEntry(entriesByReg.get(r.id)?.[0]),
      uploadedCount: entriesByReg.get(r.id)?.length ?? 0,
      acceptedRulesVersionId: r.rulesVersionId,
      currentRulesVersionId: currentRulesByContest.get(r.contestId) ?? null,
      contest: {
        ...withoutUploadPolicy(r.contest),
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
          uploadPolicyJson: true,
          categories: {
            where: { status: "ACTIVE" },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, slug: true, maxFiles: true },
          },
        },
      },
      category: {
        select: { id: true, name: true, slug: true, maxFiles: true },
      },
    },
  });
  if (!r) return null;

  const entries = realEntries(
    await prisma.fotorankContestEntry.findMany({
      where: { registrationId: r.id },
      orderBy: { createdAt: "asc" },
      select: ENTRY_SELECT,
    }),
  );

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
    maxFiles: totalEntryLimit(r),
    registrationStatus: r.status,
    paymentStatus: r.paymentStatus,
    registeredAt: r.registeredAt,
    confirmedAt: r.confirmedAt,
    entry: mapEntry(entries[0]),
    uploadedCount: entries.length,
    acceptedRulesVersionId: r.rulesVersionId,
    currentRulesVersionId: currentRules?.id ?? null,
    contest: {
      ...withoutUploadPolicy(r.contest),
      timezone: r.contest.timezone ?? null,
    },
    resultsPublished: Boolean(published),
    now,
    surface: "detail",
  });
}

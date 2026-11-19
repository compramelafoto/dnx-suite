import { prisma } from "@repo/db";
import { isEmptyDraftEntry, resolveCategoryEntryLimits } from "../entries/entry-quota";
import { resolveManagedContestMediaBatch, type ManagedMediaBundle } from "../contest-media/presentation-bridge";
import { resolveContestVisualTheme, resolveHeroAsset } from "../contest-visual";
import { getContestEntryStorage } from "../storage/provider";
import { buildParticipantParticipationView } from "./build-view";
import type {
  ParticipantContestCover,
  ParticipantParticipationView,
  ParticipantPhotoThumb,
} from "./types";

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
function withoutUploadPolicy<
  T extends { uploadPolicyJson: unknown; categories: unknown; coverImageUrl: unknown; organization: unknown },
>(contest: T): Omit<T, "uploadPolicyJson" | "categories" | "coverImageUrl" | "organization"> {
  const rest: Omit<T, "uploadPolicyJson" | "categories" | "coverImageUrl" | "organization"> & {
    uploadPolicyJson?: unknown;
    categories?: unknown;
    coverImageUrl?: unknown;
    organization?: unknown;
  } = {
    ...contest,
  };
  delete rest.uploadPolicyJson;
  delete rest.categories;
  delete rest.coverImageUrl;
  delete rest.organization;
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
 * Portada del concurso con la misma regla que la tarjeta pública: primero la
 * imagen de tarjeta cargada por el organizador, después el banner, después
 * `coverImageUrl` y por último la del tema en código (Santa Fe en Foco).
 */
function resolveCover(input: {
  slug: string;
  title: string;
  organizerName: string | null;
  coverImageUrl: string | null;
  managed: ManagedMediaBundle | null;
}): ParticipantContestCover | null {
  try {
    const theme = resolveContestVisualTheme(input.slug, undefined, {
      coverImageUrl: input.coverImageUrl,
      contestTitle: input.title,
      organizerName: input.organizerName ?? undefined,
      managed: input.managed
        ? { ...input.managed, banner: input.managed.card ?? input.managed.banner }
        : null,
    });
    const hero = resolveHeroAsset(theme.presentation, "desktop");
    if (!hero?.url) return null;
    return { url: hero.url, alt: hero.alt?.trim() || `Imagen de ${input.title}` };
  } catch {
    return null;
  }
}

/** Duración del enlace firmado de cada miniatura. La página se vuelve a pedir al navegar. */
const THUMB_TTL_SEC = 60 * 30;

/**
 * Miniaturas de las obras. Un fallo del almacenamiento no puede tirar el panel:
 * en ese caso la obra se muestra sin imagen.
 */
async function loadPhotoThumbs(entries: EntryRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (entries.length === 0) return out;
  try {
    const assets = await prisma.fotorankContestEntryAsset.findMany({
      where: {
        entryId: { in: entries.map((e) => e.id) },
        isActive: true,
        kind: { in: ["THUMBNAIL", "JURY_PREVIEW"] },
      },
      select: { entryId: true, kind: true, storageKey: true },
    });
    const byEntry = new Map<string, { kind: string; storageKey: string }>();
    for (const a of assets) {
      if (!a.entryId) continue;
      const prev = byEntry.get(a.entryId);
      if (!prev || (prev.kind !== "THUMBNAIL" && a.kind === "THUMBNAIL")) {
        byEntry.set(a.entryId, { kind: a.kind, storageKey: a.storageKey });
      }
    }
    const storage = getContestEntryStorage();
    await Promise.all(
      [...byEntry.entries()].map(async ([entryId, a]) => {
        try {
          out.set(entryId, await storage.getSignedUrl(a.storageKey, "read", THUMB_TTL_SEC));
        } catch {
          /* sin miniatura */
        }
      }),
    );
  } catch {
    /* sin miniaturas */
  }
  return out;
}

function toPhotos(entries: EntryRow[] | undefined, thumbs: Map<string, string>): ParticipantPhotoThumb[] {
  return (entries ?? []).map((e) => ({
    entryId: e.id,
    entryNumber: e.entryNumber,
    status: e.admissionStatus === "REJECTED" ? "REJECTED" : e.status,
    thumbUrl: thumbs.get(e.id) ?? null,
  }));
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
          coverImageUrl: true,
          organization: { select: { name: true } },
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
  const [thumbs, managedByContest] = await Promise.all([
    loadPhotoThumbs([...entriesByReg.values()].flat()),
    resolveManagedContestMediaBatch(contestIds).catch(() => new Map<string, ManagedMediaBundle>()),
  ]);
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
      organizerName: r.contest.organization?.name ?? null,
      cover: resolveCover({
        slug: r.contest.slug,
        title: r.contest.title,
        organizerName: r.contest.organization?.name ?? null,
        coverImageUrl: r.contest.coverImageUrl,
        managed: managedByContest.get(r.contestId) ?? null,
      }),
      photos: toPhotos(entriesByReg.get(r.id), thumbs),
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
          coverImageUrl: true,
          organization: { select: { name: true } },
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

  const [thumbs, managedByContest] = await Promise.all([
    loadPhotoThumbs(entries),
    resolveManagedContestMediaBatch([r.contestId]).catch(() => new Map<string, ManagedMediaBundle>()),
  ]);

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
    organizerName: r.contest.organization?.name ?? null,
    cover: resolveCover({
      slug: r.contest.slug,
      title: r.contest.title,
      organizerName: r.contest.organization?.name ?? null,
      coverImageUrl: r.contest.coverImageUrl,
      managed: managedByContest.get(r.contestId) ?? null,
    }),
    photos: toPhotos(entries, thumbs),
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

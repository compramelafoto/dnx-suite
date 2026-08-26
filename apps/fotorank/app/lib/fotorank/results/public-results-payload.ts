import { prisma } from "@repo/db";
import { parsePublicationMeta } from "./publication-types";

/** Campos prohibidos en payload público de resultados. */
export const PUBLIC_RESULTS_FORBIDDEN_KEYS = [
  "email",
  "phone",
  "argra",
  "gpsLatitude",
  "gpsLongitude",
  "storageKey",
  "originalFileName",
  "sha256",
  "authorUserId",
  "participantUserId",
  "privateComment",
  "aggregateScore",
  "normalizedScore",
  "medianScore",
  "dispersion",
  "evaluationCount",
  "juryDecisionNote",
  "conflict",
  "abstention",
] as const;

export function assertPublicResultsPayloadSafe(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof value !== "object") return;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${k}` : k;
      if ((PUBLIC_RESULTS_FORBIDDEN_KEYS as readonly string[]).includes(k)) {
        found.push(next);
      }
      walk(v, next);
    }
  };
  walk(payload, "");
  return found;
}

/**
 * Payload público sanitizado. Solo si batch PUBLISHED + meta.publication.status=LIVE.
 * No recalcula ranking. Scores ocultos por defecto.
 */
export async function getPublicResultsPayload(input: { contestSlug: string }) {
  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: input.contestSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      categories: { where: { status: "ACTIVE" }, select: { id: true, slug: true, name: true } },
    },
  });
  if (!contest) return { published: false as const, reason: "NOT_FOUND" as const };

  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { contestId: contest.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      entries: {
        where: { resultStatus: { not: "DISQUALIFIED" } },
        orderBy: [{ categoryId: "asc" }, { finalPosition: "asc" }],
      },
    },
  });
  if (!batch) return { published: false as const, reason: "NOT_PUBLISHED" as const };

  const meta = parsePublicationMeta(batch.metadata);
  if (meta.publication?.status !== "LIVE") {
    return { published: false as const, reason: "NOT_LIVE" as const };
  }
  if (meta.publication?.stagingTest) {
    // staging fixture visible solo en preview — el caller decide
  }

  const showScores = meta.publication?.publicScoresMode === "TOTAL_ONLY";

  const categories = contest.categories.map((cat) => {
    const winners = (meta.winnerSelections ?? []).filter((w) => w.categoryId === cat.id);
    const finalists = (meta.finalistSelections ?? []).filter(
      (f) => f.categoryId === cat.id && (f.status === "AUTO_SELECTED" || f.status === "MANUALLY_SELECTED" || f.status === "APPROVED"),
    );
    const ranked = batch.entries
      .filter((e) => e.categoryId === cat.id)
      .map((e) => ({
        anonymousCode: e.anonymousCode,
        position: e.finalPosition ?? e.preliminaryPosition,
        recognition: e.awardType,
        ...(showScores ? { scoreTotal: e.aggregateScore } : {}),
      }));
    return {
      slug: cat.slug,
      name: cat.name,
      winners: winners.map((w) => ({
        anonymousCode: w.anonymousCode,
        awardType: w.awardType,
      })),
      finalists: finalists.map((f) => ({
        anonymousCode: f.anonymousCode,
      })),
      ranking: ranked,
    };
  });

  const payload = {
    published: true as const,
    contest: { slug: contest.slug, title: contest.title },
    publishedAt: meta.publication?.publishedAt ?? batch.publishedAt?.toISOString() ?? null,
    timezone: meta.publication?.timezone ?? "America/Argentina/Cordoba",
    stagingTest: Boolean(meta.publication?.stagingTest),
    publicationHash: meta.publication?.hash ?? null,
    scoresVisible: showScores,
    categories,
    creditsPolicy: meta.publicCreditsPolicy,
    note: meta.publication?.stagingTest
      ? "STAGING_TEST_PUBLICATION — no oficial"
      : "Resultados publicados",
  };

  const leaks = assertPublicResultsPayloadSafe(payload);
  if (leaks.length) {
    throw new Error(`Public results payload leaked: ${leaks.join(",")}`);
  }
  return payload;
}

/**
 * ETAPA 16B — Revisión de finalistas para el organizador (solo lectura).
 * Imagen (preview firmado, nunca original), publicCode, score de jurado (SOLO organizador,
 * nunca expuesto al público en esta etapa) y estado de asset social. Complementa
 * `finalists-engine.ts` (cálculo) y `finalist-package.ts` (confirmar/revocar) sin duplicarlos.
 */
import { prisma } from "@repo/db";
import { getContestEntryStorage } from "../storage/provider";

export type FinalistReviewRow = {
  id: string;
  promptExternalId: string;
  promptSequence: number | null;
  promptTitle: string | null;
  publicCode: string;
  anonymousCode: string;
  internalJuryRank: number;
  /** Score del jurado — SOLO organizador; nunca se expone al público en esta etapa. */
  aggregateScore: number | null;
  normalizedScore: number | null;
  derivativeStatus: string;
  status: string;
  previewUrl: string | null;
  confirmedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type FinalistsReviewResult = {
  packageStatus: string | null;
  positionsCount: number;
  rows: FinalistReviewRow[];
};

export async function getFinalistsForReview(input: {
  contestId: string;
  scoringSessionId: string;
}): Promise<FinalistsReviewResult> {
  const pkg = await prisma.fotorankFinalistPackage.findFirst({
    where: { contestId: input.contestId, scoringSessionId: input.scoringSessionId },
    orderBy: { createdAt: "desc" },
  });

  const snapshots = await prisma.fotorankFinalistSnapshot.findMany({
    where: { contestId: input.contestId, scoringSessionId: input.scoringSessionId },
    include: {
      juryEntrySnapshot: { select: { anonymousCode: true } },
      entry: {
        select: {
          assets: {
            where: { isActive: true, kind: { in: ["JURY_PREVIEW", "THUMBNAIL"] } },
            select: { storageKey: true, kind: true },
          },
        },
      },
    },
    orderBy: [{ promptSequence: "asc" }, { internalJuryRank: "asc" }],
  });

  // Storage opcional: en ops/E2E sin R2 no debe tumbar la revisión de finalistas.
  let storage: ReturnType<typeof getContestEntryStorage> | null = null;
  try {
    storage = getContestEntryStorage();
  } catch {
    storage = null;
  }
  const rows: FinalistReviewRow[] = [];
  for (const snap of snapshots) {
    const assets = snap.entry?.assets ?? [];
    const asset = assets.find((a) => a.kind === "JURY_PREVIEW") ?? assets.find((a) => a.kind === "THUMBNAIL");
    let previewUrl: string | null = null;
    if (asset && storage) {
      try {
        previewUrl = await storage.getSignedUrl(asset.storageKey, "read", 600);
      } catch {
        previewUrl = null;
      }
    }
    rows.push({
      id: snap.id,
      promptExternalId: snap.promptExternalId,
      promptSequence: snap.promptSequence,
      promptTitle: null,
      publicCode: snap.publicCode,
      anonymousCode: snap.juryEntrySnapshot.anonymousCode,
      internalJuryRank: snap.internalJuryRank,
      aggregateScore: snap.aggregateScore,
      normalizedScore: snap.normalizedScore,
      derivativeStatus: snap.derivativeStatus,
      status: snap.status,
      previewUrl,
      confirmedAt: snap.confirmedAt?.toISOString() ?? null,
      revokedAt: snap.revokedAt?.toISOString() ?? null,
      revokeReason: snap.revokeReason,
    });
  }

  const promptIds = [...new Set(rows.map((r) => r.promptExternalId))];
  if (promptIds.length) {
    const promptRows = await prisma.clickatonPrompt.findMany({
      where: { id: { in: promptIds } },
      select: { id: true, title: true },
    });
    const titleById = new Map(promptRows.map((p) => [p.id, p.title]));
    for (const r of rows) r.promptTitle = titleById.get(r.promptExternalId) ?? null;
  }

  return {
    packageStatus: pkg?.status ?? null,
    positionsCount: pkg?.positionsCount ?? rows.filter((r) => r.status !== "REVOKED").length,
    rows,
  };
}

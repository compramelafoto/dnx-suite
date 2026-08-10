/**
 * ETAPA 16B — Preparación de assets sociales de finalistas (stub-safe).
 * Marca `derivativeStatus READY` con una política de placeholder (recorte/aspecto/marca de agua
 * documentados en metadata). NO sube nada a Instagram/redes, NO publica, y NUNCA expone la key
 * de storage del original — solo una referencia derivada "social-safe" (placeholder en esta etapa).
 */
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertNoPiiInFinalistMetadata } from "./finalist-pii-guard";

export type SocialAssetPolicy = {
  aspectRatio: string;
  cropStrategy: string;
  watermark: string;
  notes: string;
};

/** Política default documental — no ejecuta ningún procesamiento de imagen real en esta etapa. */
export function getDefaultSocialAssetPolicy(): SocialAssetPolicy {
  return {
    aspectRatio: "1:1",
    cropStrategy: "CENTER_SAFE_CROP_PENDING_REVIEW",
    watermark: "DNX_CLICKATON_WATERMARK_PENDING_REVIEW",
    notes: "Placeholder ETAPA 16B — recorte/marca de agua definitivos requieren decisión de producto + legal review.",
  };
}

function buildPlaceholderAssetKey(input: { contestId: string; promptExternalId: string; publicCode: string }): string {
  return `social-safe-placeholder/${input.contestId}/${input.promptExternalId}/${input.publicCode}`;
}

/**
 * Marca como READY (con placeholder) los derivados sociales pendientes de una sesión.
 * No es un pipeline de procesamiento de imagen real; deja trazabilidad de la política aplicada.
 */
export async function prepareFinalistPublicAssets(input: {
  contestId: string;
  scoringSessionId: string;
  actorUserId: number;
  policy?: SocialAssetPolicy;
}) {
  const policy = input.policy ?? getDefaultSocialAssetPolicy();

  const pending = await prisma.fotorankFinalistSnapshot.findMany({
    where: {
      contestId: input.contestId,
      scoringSessionId: input.scoringSessionId,
      status: { in: ["DRAFT", "CONFIRMED"] },
      derivativeStatus: { not: "READY" },
    },
  });

  const results: Array<{ finalistSnapshotId: string; derivativeAssetKey: string }> = [];

  for (const snapshot of pending) {
    const derivativeAssetKey = buildPlaceholderAssetKey({
      contestId: input.contestId,
      promptExternalId: snapshot.promptExternalId,
      publicCode: snapshot.publicCode,
    });
    const metadataJson = {
      ...((snapshot.metadataJson as Record<string, unknown>) ?? {}),
      socialAssetPolicy: policy,
      assetPreparedAt: new Date().toISOString(),
      assetPreparedByUserId: input.actorUserId,
      // Nunca originalStorageKey / assetId original aquí — solo placeholder derivado.
    };
    assertNoPiiInFinalistMetadata(metadataJson);

    await prisma.fotorankFinalistSnapshot.update({
      where: { id: snapshot.id },
      data: {
        derivativeAssetKey,
        derivativeStatus: "READY",
        metadataJson,
      },
    });
    results.push({ finalistSnapshotId: snapshot.id, derivativeAssetKey });
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (contest) {
    await prisma.fotorankJudgeAuditEvent.create({
      data: {
        organizationId: contest.organizationId,
        contestId: input.contestId,
        actorType: "ADMIN",
        actorUserId: input.actorUserId,
        eventType: "FINALIST_PUBLIC_ASSETS_PREPARED",
        entityType: "FotorankFinalistSnapshot",
        entityId: input.scoringSessionId,
        payloadJson: { preparedCount: results.length, policy, live: false, publishedToInstagram: false },
      },
    });
  }

  return { preparedCount: results.length, results, policy };
}

/** Marca un derivado como fallido (p. ej. asset original no disponible) — auditado, no bloquea otros. */
export async function markFinalistAssetFailed(input: {
  finalistSnapshotId: string;
  actorUserId: number;
  reason: string;
}) {
  const snapshot = await prisma.fotorankFinalistSnapshot.findUnique({ where: { id: input.finalistSnapshotId } });
  if (!snapshot) throw new JuryError("SNAPSHOT_NOT_FOUND_16B", "Finalista no encontrado.", 404);

  const metadataJson = {
    ...((snapshot.metadataJson as Record<string, unknown>) ?? {}),
    assetFailureReason: input.reason,
    assetFailedAt: new Date().toISOString(),
  };
  assertNoPiiInFinalistMetadata(metadataJson);

  return prisma.fotorankFinalistSnapshot.update({
    where: { id: input.finalistSnapshotId },
    data: { derivativeStatus: "FAILED", metadataJson },
  });
}

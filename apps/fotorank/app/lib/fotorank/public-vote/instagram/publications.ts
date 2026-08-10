/**
 * ETAPA 17B — Publicaciones PREPARED → APPROVED → PUBLISHED (mock por defecto).
 */
import { createHash } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { PublicVoteError } from "../errors";
import { writePublicVoteAudit } from "../audit";
import { buildSocialAssetSnapshot, defaultCaptionTemplate } from "./social-assets";
import { mockPublishImage } from "./mock-http";
import { assertOrgOwnsConnection } from "./social-connection";

export async function preparePublicationsForRound(input: {
  roundId: string;
  organizationId: string;
  socialConnectionId: string;
}) {
  await assertOrgOwnsConnection({
    organizationId: input.organizationId,
    socialConnectionId: input.socialConnectionId,
  });

  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.roundId },
    include: {
      candidates: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      contest: { select: { organizationId: true } },
    },
  });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  if (round.contest.organizationId !== input.organizationId) {
    throw new PublicVoteError("FORBIDDEN", "Ronda ajena a la organización.", 403);
  }

  const prepared = [];
  for (const cand of round.candidates) {
    const finalist = cand.finalistSnapshotId
      ? await prisma.fotorankFinalistSnapshot.findUnique({
          where: { id: cand.finalistSnapshotId },
        })
      : null;
    const asset = buildSocialAssetSnapshot({
      publicCode: cand.publicCode,
      promptExternalId: round.unitKey,
      derivativeAssetKey: finalist?.derivativeAssetKey ?? null,
    });
    const idempotencyKey = createHash("sha256")
      .update(`${round.id}:${cand.id}:instagram:image`)
      .digest("hex");
    const caption = defaultCaptionTemplate({
      publicCode: cand.publicCode,
      promptExternalId: round.unitKey,
      endsAt: round.endsAt,
      timezone: round.timezone,
    });
    const pub = await prisma.fotorankPublicVotePublication.upsert({
      where: { roundId_candidateId: { roundId: round.id, candidateId: cand.id } },
      create: {
        roundId: round.id,
        candidateId: cand.id,
        socialConnectionId: input.socialConnectionId,
        provider: "INSTAGRAM",
        publicationStatus: "PREPARED",
        publicationType: "IMAGE",
        captionSnapshot: caption,
        assetSnapshotJson: asset as unknown as Prisma.JsonObject,
        socialAssetHash: asset.socialAssetHash,
        idempotencyKey,
      },
      update: {
        captionSnapshot: caption,
        assetSnapshotJson: asset as unknown as Prisma.JsonObject,
        socialAssetHash: asset.socialAssetHash,
        publicationStatus: "PREPARED",
      },
    });
    prepared.push(pub);
  }

  await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: { socialConnectionId: input.socialConnectionId, provider: "INSTAGRAM" },
  });

  await writePublicVoteAudit({
    contestId: round.contestId,
    eventType: "PUBLICATION_PREPARED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { count: prepared.length },
  });

  return { roundId: round.id, publications: prepared };
}

export async function approvePublicationsForRound(input: {
  roundId: string;
  actorUserId?: number;
}) {
  const pubs = await prisma.fotorankPublicVotePublication.findMany({
    where: { roundId: input.roundId, publicationStatus: "PREPARED" },
  });
  if (pubs.length === 0) {
    throw new PublicVoteError("INVALID_STATE", "No hay publicaciones PREPARED.", 409);
  }
  await prisma.fotorankPublicVotePublication.updateMany({
    where: { roundId: input.roundId, publicationStatus: "PREPARED" },
    data: { publicationStatus: "APPROVED_FOR_PUBLICATION" },
  });
  const round = await prisma.fotorankPublicVoteRound.findUniqueOrThrow({
    where: { id: input.roundId },
  });
  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLICATION_APPROVED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { count: pubs.length },
  });
  return { roundId: input.roundId, approved: pubs.length };
}

export async function publishApprovedPublications(input: {
  roundId: string;
  actorUserId?: number;
}) {
  if (process.env.FOTORANK_ALLOW_INSTAGRAM_PUBLISH !== "1") {
    throw new PublicVoteError(
      "PROVIDER_NOT_ALLOWED",
      "Publicación Instagram real deshabilitada (mock only). Set FOTORANK_ALLOW_INSTAGRAM_PUBLISH=1 para probe.",
      403,
    );
  }

  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.roundId },
    include: {
      publications: {
        where: { publicationStatus: "APPROVED_FOR_PUBLICATION" },
        include: { socialConnection: true },
      },
    },
  });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);

  const published = [];
  for (const pub of round.publications) {
    const conn = pub.socialConnection;
    if (!conn) continue;
    const asset = pub.assetSnapshotJson as { derivativeAssetKey?: string | null } | null;
    const result = await mockPublishImage({
      idempotencyKey: pub.idempotencyKey,
      caption: pub.captionSnapshot ?? "",
      imageUrl: asset?.derivativeAssetKey ?? "",
      accountId: conn.accountId,
    });
    const updated = await prisma.fotorankPublicVotePublication.update({
      where: { id: pub.id },
      data: {
        publicationStatus: "PUBLISHED",
        externalMediaId: result.externalMediaId,
        externalContainerId: result.externalContainerId,
        permalink: result.permalink,
        publishedAt: new Date(),
        providerMetadataJson: { idempotent: result.idempotent, mock: true },
      },
    });
    published.push(updated);
  }

  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLICATION_PUBLISHED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { count: published.length },
  });

  return { roundId: round.id, published };
}

export function evaluatePublicationFairness(
  publications: Array<{ publishedAt: Date | null; publicationStatus: string }>,
): { fair: boolean; maxSkewMs: number } {
  const times = publications
    .filter((p) => p.publicationStatus === "PUBLISHED" && p.publishedAt)
    .map((p) => p.publishedAt!.getTime());
  if (times.length < 2) return { fair: true, maxSkewMs: 0 };
  const maxSkewMs = Math.max(...times) - Math.min(...times);
  return { fair: maxSkewMs <= 5 * 60_000, maxSkewMs };
}

export async function markPartialPublicationIfNeeded(roundId: string) {
  const pubs = await prisma.fotorankPublicVotePublication.findMany({ where: { roundId } });
  const required = pubs.length;
  const published = pubs.filter((p) => p.publicationStatus === "PUBLISHED").length;
  if (required > 0 && published > 0 && published < required) {
    await prisma.fotorankPublicVoteRound.update({
      where: { id: roundId },
      data: { incidentStatus: "PUBLICATION_INCOMPLETE" },
    });
    return { incomplete: true, published, required };
  }
  return { incomplete: false, published, required };
}

export async function assertRoundPublicationsComplete(roundId: string) {
  const pubs = await prisma.fotorankPublicVotePublication.findMany({ where: { roundId } });
  const allPublished = pubs.every((p) => p.publicationStatus === "PUBLISHED" && p.externalMediaId);
  if (!allPublished) {
    throw new PublicVoteError(
      "NOT_READY",
      "Publicaciones incompletas para abrir votación competitiva.",
      409,
    );
  }
  return pubs;
}

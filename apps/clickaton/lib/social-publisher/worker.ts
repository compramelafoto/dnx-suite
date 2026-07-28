import {
  createInstagramPublishProvider,
  decryptSecret,
  nextRetryAt,
  tryLoadSocialMasterKeyFromEnv,
  type PublishAsset,
} from "@repo/social-publisher";
import { Prisma, prisma } from "@/lib/admin/db";
import { logSocialRequest, toSocialAccount } from "./prisma-store";
import { enqueueWelcomePublishAfterPaid } from "./enqueue-welcome-publish";

type DueStatus = "APPROVED" | "SCHEDULED" | "FAILED";
const dueStatuses: DueStatus[] = ["APPROVED", "SCHEDULED", "FAILED"];

function readAssets(value: Prisma.JsonValue): PublishAsset[] {
  return Array.isArray(value) ? value.filter((item): item is PublishAsset =>
    item !== null && typeof item === "object" && "assetId" in item && "kind" in item,
  ) : [];
}

export async function processDueSocialPublishes(limit = 25) {
  const now = new Date();
  const pendingOutbox = await prisma.clickatonIntegrationOutboxEvent.findMany({
    where: {
      eventType: "CLICKATON_WELCOME_PUBLISH_PENDING",
      status: { in: ["PENDING", "FAILED"] },
      availableAt: { lte: now },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  for (const event of pendingOutbox) {
    if (!event.editionId) continue;
    const queued = await enqueueWelcomePublishAfterPaid({
      registrationId: event.aggregateId,
      editionId: event.editionId,
    });
    if (queued.ok) {
      await prisma.clickatonIntegrationOutboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    }
  }
  const requests = await prisma.dnxSocialPublishRequest.findMany({
    where: {
      application: "CLICKATON",
      status: { in: dueStatuses },
      OR: [
        { status: { in: ["APPROVED", "SCHEDULED"] }, scheduleAt: null },
        { status: { in: ["APPROVED", "SCHEDULED"] }, scheduleAt: { lte: now } },
        { status: "FAILED", nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const request of requests) await processSocialPublishRequest(request.id);
  return requests.length;
}

export async function processSocialPublishRequest(requestId: string) {
  const request = await prisma.dnxSocialPublishRequest.findUnique({
    where: { id: requestId },
    include: { socialAccount: true },
  });
  if (!request || !dueStatuses.includes(request.status as DueStatus)) return { status: "SKIPPED" as const };
  const assets = readAssets(request.assets);
  if (!assets.some((asset) => asset.publicUrl)) {
    return fail(request, "ASSETS_NOT_READY", "Assets sin publicUrl", true);
  }

  // The token exists only in this function scope and is never logged or persisted.
  const masterKey = tryLoadSocialMasterKeyFromEnv();
  if (!masterKey || !request.socialAccount.tokenCiphertext || !request.socialAccount.tokenNonce || !request.socialAccount.tokenAuthTag) {
    return fail(request, "TOKEN_MISSING", "Credencial social no disponible", true);
  }

  const startedAt = new Date();
  const livePublish = process.env.DNX_SOCIAL_PUBLISHER_LIVE === "true";
  try {
    const accessToken = decryptSecret({
      ciphertext: request.socialAccount.tokenCiphertext,
      nonce: request.socialAccount.tokenNonce,
      authTag: request.socialAccount.tokenAuthTag,
    }, masterKey);
    const provider = createInstagramPublishProvider();
    await prisma.dnxSocialPublishRequest.update({
      where: { id: request.id },
      data: { status: "PUBLISHING", attemptCount: { increment: 1 } },
    });
    const result = await provider.publish({
      account: toSocialAccount(request.socialAccount),
      accessToken,
      caption: request.caption,
      assets,
      dryRun: !livePublish,
    });
    if (!result.ok) throw new Error(result.errorMessage ?? result.errorCode ?? "PUBLISH_FAILED");

    const publishedAt = new Date();
    const updated = await prisma.dnxSocialPublishRequest.update({
      where: { id: request.id },
      data: {
        status: "PUBLISHED", publishedAt, externalMediaId: result.externalMediaId ?? null,
        externalPostId: result.externalPostId ?? null, permalink: result.permalink ?? null,
        lastErrorCode: null, lastErrorMessage: null, nextRetryAt: null,
      },
    });
    await prisma.dnxSocialPublishAttempt.create({
      data: {
        publishRequestId: request.id, attemptNumber: updated.attemptCount, startedAt, finishedAt: publishedAt,
        ok: true, dryRun: !livePublish, durationMs: publishedAt.getTime() - startedAt.getTime(),
        providerRaw: (result.providerRawSanitized ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await markWelcomePublished(request, result.externalMediaId ?? null, result.externalPostId ?? null, publishedAt);
    await logSocialRequest(request.id, "PUBLISHED", null, { dryRun: !livePublish });
    return { status: "PUBLISHED" as const, dryRun: !livePublish };
  } catch (error) {
    return fail(request, "PUBLISH_FAILED", error instanceof Error ? error.message : "Publicación fallida", true, startedAt, !livePublish);
  }
}

async function markWelcomePublished(
  request: { entityType: string; entityId: string },
  metaMediaId: string | null,
  instagramPostId: string | null,
  publishedAt: Date,
) {
  if (request.entityType !== "WELCOME_CARD") return;
  const card = await prisma.dnxWelcomeCard.findFirst({
    where: { OR: [{ id: request.entityId }, { registrationId: request.entityId }] },
    select: { id: true, registrationId: true },
  });
  if (!card) return;
  await prisma.dnxWelcomeCard.update({
    where: { id: card.id },
    data: { metaMediaId, instagramPostId, publishedAt, publicationStatus: "PUBLISHED", publicationError: null },
  });
  if (card.registrationId) {
    await prisma.clickatonRegistration.update({
      where: { id: card.registrationId },
      data: { welcomePublicationStatus: "PUBLISHED" },
    });
  }
}

async function fail(
  request: { id: string; attemptCount: number; entityType: string; entityId: string },
  code: string,
  message: string,
  retryable: boolean,
  startedAt = new Date(),
  dryRun = true,
) {
  const attemptNumber = request.attemptCount + 1;
  const finishedAt = new Date();
  await prisma.dnxSocialPublishRequest.update({
    where: { id: request.id },
    data: {
      status: "FAILED", lastErrorCode: code, lastErrorMessage: message.slice(0, 200),
      nextRetryAt: retryable ? nextRetryAt(attemptNumber) : null,
    },
  });
  await prisma.dnxSocialPublishAttempt.create({
    data: {
      publishRequestId: request.id, attemptNumber, startedAt, finishedAt, ok: false, dryRun,
      errorCode: code, errorMessage: message.slice(0, 200), durationMs: finishedAt.getTime() - startedAt.getTime(),
    },
  });
  await logSocialRequest(request.id, "FAILED", null, { code });
  return { status: "FAILED" as const, code };
}

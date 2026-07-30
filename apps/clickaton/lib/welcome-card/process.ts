import { CLICKATON_WELCOME_STORY_V1, hashRenderInputs, renderComposition } from "@repo/media-composition";
import { prisma } from "@/lib/admin/db";
import { getWelcomeCardStorage, shouldInlineMediaInDb } from "./storage";
import { resolveMediaBody } from "./resolve-media-body";
import { updateWelcomePublishAssets } from "@/lib/social-publisher/enqueue-welcome-publish";

const retryAt = (attempt: number) => new Date(Date.now() + Math.min(60 * 60_000, 30_000 * 2 ** Math.min(attempt, 7)));

export async function processWelcomeCardById(cardId: string, storage = getWelcomeCardStorage(), force = false) {
  const card = await prisma.dnxWelcomeCard.findUnique({ where: { id: cardId } });
  if (!card) return { status: "NOT_FOUND" as const };
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: card.registrationId ?? card.ownerId }, include: { edition: true },
  });
  if (!registration?.profilePhotoAssetId) return fail(card, "PROFILE_PHOTO_MISSING");
  const photo = await prisma.dnxMediaAsset.findUnique({ where: { id: registration.profilePhotoAssetId } });
  if (!photo) return fail(card, "PROFILE_PHOTO_MISSING");
  const inputHash = hashRenderInputs([
    String(CLICKATON_WELCOME_STORY_V1.version), photo.contentHash, registration.firstName, registration.lastName,
    registration.instagramHandleNormalized ?? registration.instagramHandle, registration.visibleCode,
    registration.city, registration.province, registration.edition.name,
    String(registration.profilePhotoCropX ?? ""), String(registration.profilePhotoCropY ?? ""),
    String(registration.profilePhotoZoom ?? ""), String(registration.profilePhotoRotation ?? ""),
  ]);
  if (!force && card.status === "GENERATED" && card.inputHash === inputHash) return { status: "UNCHANGED" as const, cardId };
  try {
    await prisma.dnxWelcomeCard.update({ where: { id: cardId }, data: { attemptCount: { increment: 1 }, lastAttemptAt: new Date(), status: "PENDING" } });
    const output = await renderComposition({
      template: CLICKATON_WELCOME_STORY_V1,
      variables: {
        participantName: `${registration.firstName} ${registration.lastName}`.trim(),
        instagram: registration.instagramHandleNormalized ?? registration.instagramHandle ?? "",
        participantNumber: registration.visibleCode ?? "Participante Clickatón",
        city: registration.city ?? "", province: registration.province ?? "",
        editionName: registration.edition.name,
        editionDate: registration.edition.startAt?.toLocaleDateString("es-AR") ?? "",
      },
      assets: { photo: await resolveMediaBody(photo.storageKey) },
      crop: {
        cropX: registration.profilePhotoCropX ?? 0, cropY: registration.profilePhotoCropY ?? 0,
        zoom: registration.profilePhotoZoom ?? 1, rotation: registration.profilePhotoRotation ?? 0,
        boundingBox: registration.profilePhotoBoundingBox as never, strategy: registration.profilePhotoBoundingBox ? "MANUAL" : "CENTER",
      },
    });
    const [pngStored, webpStored] = await Promise.all([
      storage.put({ namespace: "welcome", extension: "png", body: output.png, contentType: "image/png" }),
      storage.put({ namespace: "welcome", extension: "webp", body: output.webp, contentType: "image/webp" }),
    ]);
    const inline = shouldInlineMediaInDb();
    const [png, webp] = await prisma.$transaction([
      prisma.dnxMediaAsset.create({
        data: {
          platform: "CLICKATON",
          ownerType: "WELCOME_CARD",
          ownerId: cardId,
          editionId: registration.editionId,
          registrationId: registration.id,
          kind: "WELCOME_CARD_PNG",
          storageBackend: inline
            ? "INLINE_DB"
            : storage.constructor.name.replace("Storage", "").toUpperCase(),
          storageKey: pngStored.key,
          publicUrl: pngStored.publicUrl,
          mimeType: "image/png",
          width: output.width,
          height: output.height,
          bytes: pngStored.bytes,
          contentHash: pngStored.contentHash,
          ...(inline
            ? { metadata: { inlineBase64: output.png.toString("base64"), inlineStorage: "db_metadata" } }
            : {}),
        },
      }),
      prisma.dnxMediaAsset.create({
        data: {
          platform: "CLICKATON",
          ownerType: "WELCOME_CARD",
          ownerId: cardId,
          editionId: registration.editionId,
          registrationId: registration.id,
          kind: "WELCOME_CARD_WEBP",
          storageBackend: inline
            ? "INLINE_DB"
            : storage.constructor.name.replace("Storage", "").toUpperCase(),
          storageKey: webpStored.key,
          publicUrl: webpStored.publicUrl,
          mimeType: "image/webp",
          width: output.width,
          height: output.height,
          bytes: webpStored.bytes,
          contentHash: webpStored.contentHash,
          ...(inline
            ? { metadata: { inlineBase64: output.webp.toString("base64"), inlineStorage: "db_metadata" } }
            : {}),
        },
      }),
    ]);
    await prisma.$transaction([
      prisma.dnxWelcomeCard.update({ where: { id: cardId }, data: { status: "GENERATED", pngAssetId: png.id, webpAssetId: webp.id, variablesSnapshot: { participantName: `${registration.firstName} ${registration.lastName}`, instagram: registration.instagramHandleNormalized ?? registration.instagramHandle }, cropSnapshot: registration.profilePhotoBoundingBox ?? undefined, contentHash: output.contentHash, inputHash, generatedAt: new Date(), nextRetryAt: null, lastErrorCode: null, lastErrorMessage: null } }),
      prisma.clickatonRegistration.update({ where: { id: registration.id }, data: { welcomeCardId: cardId, welcomeCardStatus: "GENERATED", welcomeCardAssetId: png.id, welcomePublicationStatus: "NOT_SCHEDULED" } }),
      ...(registration.fotoRankParticipantId ? [prisma.fotorankContestParticipant.update({ where: { id: registration.fotoRankParticipantId }, data: { welcomeCardAssetId: png.id, welcomeCardStatus: "GENERATED", instagramHandle: registration.instagramHandleNormalized ?? registration.instagramHandle, profilePhotoAssetId: registration.profilePhotoAssetId } })] : []),
      prisma.clickatonIntegrationOutboxEvent.updateMany({
        where: { aggregateId: registration.id, eventType: "CLICKATON_WELCOME_CARD_PENDING", status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
        data: { status: "PROCESSED", processedAt: new Date() },
      }),
    ]);
    // Etapa 9: la solicitud editorial puede haberse creado al pagar sin asset aún.
    await updateWelcomePublishAssets(cardId);
    return { status: "GENERATED" as const, cardId };
  } catch (error) {
    return fail(card, error instanceof Error ? error.message : "RENDER_FAILED");
  }
}

async function fail(card: { id: string; attemptCount: number }, reason: string) {
  const attempts = card.attemptCount + 1;
  await prisma.dnxWelcomeCard.update({ where: { id: card.id }, data: { status: "FAILED", lastErrorCode: "RENDER_FAILED", lastErrorMessage: reason.slice(0, 200), nextRetryAt: retryAt(attempts) } });
  return { status: "FAILED" as const, error: reason };
}

export async function processDueWelcomeCards(limit = 25) {
  const events = await prisma.clickatonIntegrationOutboxEvent.findMany({
    where: { eventType: "CLICKATON_WELCOME_CARD_PENDING", status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: new Date() } },
    select: { aggregateId: true },
    take: limit,
  });
  for (const event of events) {
    const card = await prisma.dnxWelcomeCard.findFirst({
      where: { registrationId: event.aggregateId, templateId: CLICKATON_WELCOME_STORY_V1.id },
      select: { id: true },
    });
    if (card) await processWelcomeCardById(card.id);
  }
  const cards = await prisma.dnxWelcomeCard.findMany({ where: { status: { in: ["PENDING", "FAILED"] }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] }, take: limit, orderBy: { createdAt: "asc" } });
  for (const card of cards) await processWelcomeCardById(card.id);
  return cards.length;
}

import { Prisma, prisma } from "@/lib/admin/db";
import {
  resolveClickatonInstagramAccount,
  toPublishAssets,
  welcomeCaption,
  WELCOME_PUBLISH_TEMPLATE,
} from "./prisma-store";

/**
 * Crea una solicitud que siempre requiere aprobación humana. Fallar aquí nunca
 * revierte un pago confirmado; el outbox deja una señal recuperable si aún no
 * existe una cuenta conectada.
 */
export async function enqueueWelcomePublishAfterPaid(input: {
  registrationId: string;
  editionId: string;
}): Promise<{ ok: boolean; requestId?: string; reason?: string }> {
  try {
    const registration = await prisma.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      include: { edition: true },
    });
    if (!registration) return { ok: false, reason: "REGISTRATION_NOT_FOUND" };
    if (registration.status !== "CONFIRMED" || registration.paymentStatus !== "APPROVED") {
      return { ok: false, reason: "NOT_PAID" };
    }

    const account = await resolveClickatonInstagramAccount();
    if (!account) {
      await prisma.clickatonIntegrationOutboxEvent.upsert({
        where: { idempotencyKey: `welcome_publish:${registration.id}` },
        create: {
          editionId: input.editionId,
          eventType: "CLICKATON_WELCOME_PUBLISH_PENDING",
          aggregateType: "ClickatonRegistration",
          aggregateId: registration.id,
          payload: { registrationId: registration.id, reason: "NO_SOCIAL_ACCOUNT" } as Prisma.InputJsonValue,
          status: "PENDING",
          availableAt: new Date(),
          idempotencyKey: `welcome_publish:${registration.id}`,
        },
        update: {},
      });
      return { ok: false, reason: "NO_SOCIAL_ACCOUNT" };
    }

    const card = await prisma.dnxWelcomeCard.findFirst({
      where: { registrationId: registration.id },
      orderBy: { createdAt: "desc" },
    });
    const png = card?.pngAssetId
      ? await prisma.dnxMediaAsset.findUnique({ where: { id: card.pngAssetId } })
      : null;
    const assets = toPublishAssets(png);
    const request = await prisma.dnxSocialPublishRequest.upsert({
      where: { idempotencyKey: `clickaton:welcome-publish:${registration.id}` },
      create: {
        application: "CLICKATON",
        entityType: "WELCOME_CARD",
        entityId: card?.id ?? registration.id,
        templateRef: WELCOME_PUBLISH_TEMPLATE,
        caption: welcomeCaption({ ...registration, editionName: registration.edition.name }),
        assets: assets as unknown as Prisma.InputJsonValue,
        socialAccountId: account.id,
        platform: "INSTAGRAM",
        status: "PENDING_APPROVAL",
        approvalRequired: true,
        idempotencyKey: `clickaton:welcome-publish:${registration.id}`,
        metadata: {
          registrationId: registration.id,
          welcomeCardId: card?.id ?? null,
        } as Prisma.InputJsonValue,
      },
      update: {
        assets: assets as unknown as Prisma.InputJsonValue,
        caption: welcomeCaption({ ...registration, editionName: registration.edition.name }),
        entityId: card?.id ?? registration.id,
      },
    });

    await prisma.clickatonRegistration.update({
      where: { id: registration.id },
      data: { welcomePublicationStatus: "NOT_SCHEDULED" },
    });
    return { ok: true, requestId: request.id };
  } catch (error) {
    console.error(JSON.stringify({
      event: "welcome_publish_enqueue_failed",
      registrationId: input.registrationId,
      reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    }));
    return { ok: false, reason: "ENQUEUE_FAILED" };
  }
}

export async function updateWelcomePublishAssets(cardId: string) {
  const card = await prisma.dnxWelcomeCard.findUnique({
    where: { id: cardId },
    include: { registration: { include: { edition: true } } },
  });
  if (!card?.registration) return;
  const png = card.pngAssetId
    ? await prisma.dnxMediaAsset.findUnique({ where: { id: card.pngAssetId } })
    : null;
  const assets = toPublishAssets(png);
  await prisma.dnxSocialPublishRequest.updateMany({
    where: {
      application: "CLICKATON",
      entityType: "WELCOME_CARD",
      entityId: { in: [card.id, card.registration.id] },
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "FAILED"] },
    },
    data: {
      assets: assets as unknown as Prisma.InputJsonValue,
      caption: welcomeCaption({ ...card.registration, editionName: card.registration.edition.name }),
    },
  });
}

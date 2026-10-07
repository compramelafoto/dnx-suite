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

    const card = await placaDeBienvenidaLista(registration.id);
    const assets = toPublishAssets(card?.asset ?? null);
    const request = await prisma.dnxSocialPublishRequest.upsert({
      where: { idempotencyKey: `clickaton:welcome-publish:${registration.id}` },
      create: {
        application: "CLICKATON",
        entityType: "WELCOME_CARD",
        entityId: registration.id,
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
          participantCardId: card?.id ?? null,
        } as Prisma.InputJsonValue,
      },
      update: {
        assets: assets as unknown as Prisma.InputJsonValue,
        caption: welcomeCaption({ ...registration, editionName: registration.edition.name }),
        entityId: registration.id,
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

/**
 * La placa de bienvenida que se publica: la última lista del sistema de placas del participante.
 *
 * Antes salía del generador viejo (`DnxWelcomeCard`), que dibujaba los textos como cuadraditos
 * porque el servidor no tiene tipografías. Se dio de baja; la placa buena es la nueva.
 */
async function placaDeBienvenidaLista(registrationId: string) {
  const card = await prisma.clickatonParticipantCard.findFirst({
    where: { registrationId, cardType: "WELCOME", status: "READY", assetId: { not: null } },
    orderBy: { generatedAt: "desc" },
    select: { id: true, assetId: true },
  });
  if (!card?.assetId) return null;
  const asset = await prisma.dnxMediaAsset.findUnique({ where: { id: card.assetId } });
  return asset ? { id: card.id, asset } : null;
}

/**
 * Completa la imagen de una solicitud que se creó al pagar, cuando la placa todavía no estaba.
 * Devuelve si quedó alguna imagen.
 */
export async function updateWelcomePublishAssets(registrationId: string): Promise<boolean> {
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    include: { edition: true },
  });
  if (!registration) return false;
  const card = await placaDeBienvenidaLista(registration.id);
  const assets = toPublishAssets(card?.asset ?? null);
  await prisma.dnxSocialPublishRequest.updateMany({
    where: {
      application: "CLICKATON",
      entityType: "WELCOME_CARD",
      entityId: registration.id,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "FAILED"] },
    },
    data: {
      assets: assets as unknown as Prisma.InputJsonValue,
      caption: welcomeCaption({ ...registration, editionName: registration.edition.name }),
    },
  });
  return assets.length > 0;
}

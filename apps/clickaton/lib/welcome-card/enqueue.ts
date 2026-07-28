import { Prisma, prisma } from "@/lib/admin/db";

const TEMPLATE_ID = "clickaton.welcome.story";

/** Durable post-payment side effect. Its failure must never change payment state. */
export async function enqueueWelcomeCardAfterPaid(input: {
  registrationId: string;
  editionId: string;
}): Promise<{ ok: boolean; cardId?: string; reason?: string }> {
  try {
    const registration = await prisma.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      select: { id: true, status: true, paymentStatus: true, profilePhotoAssetId: true },
    });
    if (!registration) return { ok: false, reason: "REGISTRATION_NOT_FOUND" };
    if (registration.status !== "CONFIRMED" || registration.paymentStatus !== "APPROVED") {
      return { ok: false, reason: "NOT_PAID" };
    }
    if (!registration.profilePhotoAssetId) return { ok: false, reason: "PROFILE_PHOTO_MISSING" };
    const card = await prisma.dnxWelcomeCard.upsert({
      where: { platform_ownerType_ownerId_templateId: { platform: "CLICKATON", ownerType: "REGISTRATION", ownerId: registration.id, templateId: TEMPLATE_ID } },
      create: {
        platform: "CLICKATON", ownerType: "REGISTRATION", ownerId: registration.id,
        editionId: input.editionId, registrationId: registration.id, templateId: TEMPLATE_ID,
        templateVersion: 1, rendererVersion: "1.0.0", status: "PENDING", nextRetryAt: new Date(),
      },
      update: {},
    });
    await prisma.clickatonIntegrationOutboxEvent.upsert({
      where: { idempotencyKey: `welcome_card:${registration.id}:${TEMPLATE_ID}` },
      create: {
        editionId: input.editionId, eventType: "CLICKATON_WELCOME_CARD_PENDING",
        aggregateType: "ClickatonRegistration", aggregateId: registration.id,
        payload: { registrationId: registration.id, welcomeCardId: card.id } as Prisma.InputJsonValue,
        status: "PENDING", availableAt: new Date(), idempotencyKey: `welcome_card:${registration.id}:${TEMPLATE_ID}`,
      },
      update: {},
    });
    await prisma.clickatonRegistration.update({
      where: { id: registration.id },
      data: { welcomeCardId: card.id, welcomeCardStatus: card.status, welcomePublicationStatus: "NOT_SCHEDULED" },
    });
    return { ok: true, cardId: card.id };
  } catch (error) {
    console.error(JSON.stringify({
      event: "welcome_card_enqueue_failed", registrationId: input.registrationId,
      reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    }));
    return { ok: false, reason: "enqueue_failed" };
  }
}

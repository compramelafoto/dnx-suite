/**
 * Smoke test Prisma Notifications (crea y limpia registros de prueba).
 *   pnpm --filter @repo/db exec tsx scripts/smoke-dnx-notifications.mts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "smoke-dnx-notifications-etapa19";

async function main() {
  const user = await prisma.user.findFirst({
    where: { isBlocked: false },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!user) throw new Error("No hay User para smoke test.");

  const pref = await prisma.dnxNotificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      nearbyPhotographerCalls: true,
      channelInApp: true,
      channelEmail: false,
    },
    update: {},
  });

  const event = await prisma.dnxNotificationEventLog.create({
    data: {
      eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceApp: "smoke",
      sourceEntityType: "Smoke",
      sourceEntityId: TAG,
      idempotencyKey: `${TAG}:${Date.now()}`,
      payloadJson: { tag: TAG },
    },
  });

  const campaign = await prisma.dnxNotificationCampaign.create({
    data: {
      eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceApp: "smoke",
      sourceEntityType: "Smoke",
      sourceEntityId: TAG,
      status: "QUEUED",
      campaignCycle: `smoke-${Date.now()}`,
      campaignDedupeKey: `${TAG}:${Date.now()}`,
      scopeMode: "RADIUS_KM",
      radiusKm: 50,
      channels: ["IN_APP"],
      title: "Smoke",
      body: "Smoke body",
      ctaUrl: "https://example.com/smoke",
      createdByUserId: user.id,
      confirmedByUserId: user.id,
      confirmedAt: new Date(),
      audienceCount: 1,
      eligibleCount: 1,
    },
  });

  const delivery = await prisma.dnxNotificationDelivery.create({
    data: {
      campaignId: campaign.id,
      userId: user.id,
      channel: "IN_APP",
      status: "PENDING",
      dedupeKey: `${TAG}:delivery:${Date.now()}`,
      publicToken: `smoke_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: "Smoke",
      body: "Smoke body",
      ctaUrl: "https://example.com/smoke",
    },
  });

  const read = await prisma.dnxNotificationDelivery.findUnique({
    where: { id: delivery.id },
  });
  if (!read) throw new Error("No se pudo leer delivery.");

  await prisma.dnxNotificationDelivery.delete({ where: { id: delivery.id } });
  await prisma.dnxNotificationCampaign.delete({ where: { id: campaign.id } });
  await prisma.dnxNotificationEventLog.delete({ where: { id: event.id } });
  // Preferencia del usuario real: no borrar si ya existía con datos; solo si la creamos en smoke.
  void pref;

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: user.id,
        prefId: pref.id,
        campaignId: campaign.id,
        deliveryId: delivery.id,
        cleaned: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

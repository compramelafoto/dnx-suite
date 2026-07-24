/**
 * Prepara fixture de atribución UI para Playwright.
 *
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-prepare-attribution
 *
 * Crea (o reutiliza) campaña IN_APP para Rosario open, corre worker, deja delivery SENT
 * del fotógrafo inapp-only y escribe `.qa-artifacts/notifications-qa-attribution.json`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@repo/db";
import { QA_PREFIX, assertQaGate, seedNotificationsQa } from "../lib/notifications/qa-kit";
import { confirmAndSendNearbyCampaign } from "../lib/notifications/nearby-call-campaign";
import { runNotificationWorker } from "../lib/notifications/worker";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, ".qa-artifacts");

async function main() {
  assertQaGate();
  mkdirSync(artifacts, { recursive: true });
  const manifest = await seedNotificationsQa();

  const rosario = await prisma.infoSpotEvent.findFirst({
    where: { slug: "qa-notif-rosario-open" },
    include: { photographerCall: true },
  });
  if (!rosario?.photographerCall?.clfEventId) {
    throw new Error("Seed incompleto: rosario-open sin clfEventId");
  }

  const photo = await prisma.user.findFirst({
    where: { email: "qa-notif-inapp-only@dnx-qa-notifications.invalid" },
    select: { id: true },
  });
  if (!photo) throw new Error("Falta fotógrafo QA inapp-only");

  // Limpiar membresía/atribución previa para poder re-inscribir en UI
  await prisma.dnxNotificationAttribution.deleteMany({
    where: {
      userId: photo.id,
      clfEventId: rosario.photographerCall.clfEventId,
    },
  });
  await prisma.eventMember.deleteMany({
    where: { eventId: rosario.photographerCall.clfEventId, userId: photo.id },
  });

  // Reutilizar delivery SENT reciente si existe (evita "sin elegibles" por exclusiones).
  let delivery = await prisma.dnxNotificationDelivery.findFirst({
    where: {
      userId: photo.id,
      channel: "IN_APP",
      status: "SENT",
      campaign: {
        title: { contains: "attribution-ui" },
        clfEventId: rosario.photographerCall.clfEventId,
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicToken: true, campaignId: true },
  });

  if (!delivery?.publicToken) {
    const campaign = await confirmAndSendNearbyCampaign({
      infoSpotEventId: rosario.id,
      scope: { mode: "RADIUS_KM", km: 50 },
      actorUserId: manifest.actorUserId!,
      actorIsDirectorOrSuperAdmin: true,
      title: `${QA_PREFIX} attribution-ui`,
      confirmed: true,
      channels: ["IN_APP"],
      campaignCycle: `qa-attr-ui-${Date.now()}`,
      runWorkerAfterQueue: false,
    });
    if (!campaign.ok) throw new Error(`campaign: ${campaign.error}`);

    await runNotificationWorker({ batchSize: 100 });

    delivery = await prisma.dnxNotificationDelivery.findFirst({
      where: {
        campaignId: campaign.campaignId,
        userId: photo.id,
        channel: "IN_APP",
        status: "SENT",
      },
      select: { id: true, publicToken: true, campaignId: true },
    });
  }
  if (!delivery?.publicToken) {
    throw new Error("No hay delivery SENT IN_APP para photo_inapp");
  }

  const evt = await prisma.event.findUnique({
    where: { id: rosario.photographerCall.clfEventId },
    select: { shareSlug: true },
  });
  if (!evt?.shareSlug) throw new Error("Evento CLF sin shareSlug");

  const fixture = {
    publicToken: delivery.publicToken,
    shareSlug: evt.shareSlug,
    campaignId: delivery.campaignId,
    deliveryId: delivery.id,
    userId: photo.id,
    clfEventId: rosario.photographerCall.clfEventId,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(
    resolve(artifacts, "notifications-qa-attribution.json"),
    JSON.stringify(fixture, null, 2),
  );
  console.log(
    JSON.stringify({
      ok: true,
      campaignIdPrefix: fixture.campaignId.slice(0, 8),
      shareSlug: fixture.shareSlug,
      userId: fixture.userId,
    }),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

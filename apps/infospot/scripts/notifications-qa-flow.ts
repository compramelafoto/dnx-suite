/**
 * Flujo QA automatizado (DB) — Etapa 20.
 * Requiere:
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1
 *
 *   pnpm --filter infospot notifications:qa-flow
 *
 * No envía emails reales a usuarios. Override opcional:
 *   DNX_NOTIFICATIONS_EMAIL_OVERRIDE=qa@example.com
 */
import { prisma } from "@repo/db";
import {
  previewNearbyPhotographerAudience,
  confirmAndSendNearbyCampaign,
} from "../lib/notifications/nearby-call-campaign";
import {
  cancelNotificationCampaign,
  retryFailedCampaignDeliveries,
} from "../lib/notifications/campaign-ops";
import { runNotificationWorker } from "../lib/notifications/worker";
import { reconcileNotifications } from "../lib/notifications/reconcile";
import {
  seedNotificationsQa,
  cleanupNotificationsQa,
  anonymizeDbUrl,
  QA_PREFIX,
} from "../lib/notifications/qa-kit";
import { listNotificationCampaigns, getCampaignAdminDetail } from "../lib/notifications/campaign-admin";

type GeoRow = {
  city: string;
  radio: string;
  found: number;
  eligible: number;
  excluded: number;
  result: string;
};

async function main() {
  const report: Record<string, unknown> = {
    db: anonymizeDbUrl(process.env.DATABASE_URL || ""),
    nodeEnv: process.env.NODE_ENV || null,
    emailOverride: process.env.DNX_NOTIFICATIONS_EMAIL_OVERRIDE ? "set" : "missing",
    cronSecret: process.env.CRON_SECRET ? "set" : "missing",
  };

  const manifest = await seedNotificationsQa();
  report.seed = {
    photographers: manifest.photographerUserIds.length,
    events: manifest.infoSpotEventIds.length,
    clfEvents: manifest.clfEventIds.length,
    actorUserId: manifest.actorUserId,
  };

  const rosario = await prisma.infoSpotEvent.findFirst({
    where: { slug: "qa-notif-rosario-open" },
    include: { photographerCall: true },
  });
  if (!rosario?.photographerCall) {
    throw new Error("Seed incompleto: falta rosario-open");
  }

  const actorUserId = manifest.actorUserId!;
  const geo: GeoRow[] = [];
  const scopes: Array<{ label: string; mode: "RADIUS_KM" | "CITY" | "PROVINCE"; km?: number }> = [
    { label: "10 km", mode: "RADIUS_KM", km: 10 },
    { label: "25 km", mode: "RADIUS_KM", km: 25 },
    { label: "50 km", mode: "RADIUS_KM", km: 50 },
    { label: "100 km", mode: "RADIUS_KM", km: 100 },
    { label: "ciudad", mode: "CITY" },
    { label: "provincia", mode: "PROVINCE" },
  ];

  for (const s of scopes) {
    const preview = await previewNearbyPhotographerAudience({
      infoSpotEventId: rosario.id,
      scope: { mode: s.mode, km: s.km ?? null },
      actorIsDirectorOrSuperAdmin: true,
      channels: ["IN_APP", "EMAIL"],
    });
    if (!preview.ok) {
      geo.push({
        city: "Rosario",
        radio: s.label,
        found: 0,
        eligible: 0,
        excluded: 0,
        result: `ERROR: ${preview.error}`,
      });
      continue;
    }
    geo.push({
      city: "Rosario",
      radio: s.label,
      found: preview.buckets.found,
      eligible: preview.buckets.eligible,
      excluded: preview.buckets.excluded,
      result: "OK",
    });
  }

  for (const slug of ["qa-notif-santafe-open", "qa-notif-caba-open"] as const) {
    const ev = await prisma.infoSpotEvent.findFirst({ where: { slug } });
    if (!ev) continue;
    for (const s of [
      { label: "25 km", mode: "RADIUS_KM" as const, km: 25 },
      { label: "50 km", mode: "RADIUS_KM" as const, km: 50 },
      { label: "ciudad", mode: "CITY" as const },
      { label: "provincia", mode: "PROVINCE" as const },
    ]) {
      const preview = await previewNearbyPhotographerAudience({
        infoSpotEventId: ev.id,
        scope: { mode: s.mode, km: s.km ?? null },
        actorIsDirectorOrSuperAdmin: true,
        channels: ["IN_APP"],
      });
      const city = slug.includes("santafe") ? "Santa Fe" : "CABA";
      if (!preview.ok) {
        geo.push({
          city,
          radio: s.label,
          found: 0,
          eligible: 0,
          excluded: 0,
          result: `ERROR: ${preview.error}`,
        });
        continue;
      }
      geo.push({
        city,
        radio: s.label,
        found: preview.buckets.found,
        eligible: preview.buckets.eligible,
        excluded: preview.buckets.excluded,
        result: "OK",
      });
    }
  }
  report.geo = geo;

  // Campaña IN_APP (sin worker inmediato) para probar cancelación
  const cancelCampaign = await confirmAndSendNearbyCampaign({
    infoSpotEventId: rosario.id,
    scope: { mode: "RADIUS_KM", km: 50 },
    actorUserId,
    actorIsDirectorOrSuperAdmin: true,
    title: `${QA_PREFIX} cancel-test`,
    confirmed: true,
    channels: ["IN_APP"],
    campaignCycle: `qa-cancel-${Date.now()}`,
    runWorkerAfterQueue: false,
  });
  if (!cancelCampaign.ok) throw new Error(`cancel campaign: ${cancelCampaign.error}`);
  const cancelled = await cancelNotificationCampaign({
    campaignId: cancelCampaign.campaignId,
    actorUserId,
    reason: "QA Etapa 20 — cancelación controlada",
  });
  const workerAfterCancel = await runNotificationWorker({ batchSize: 50 });
  const pendingAfterCancel = await prisma.dnxNotificationDelivery.count({
    where: {
      campaignId: cancelCampaign.campaignId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  report.cancel = {
    campaignId: cancelCampaign.campaignId.slice(0, 8) + "…",
    cancelledPending: cancelled.ok ? cancelled.cancelledPending : 0,
    pendingAfterWorker: pendingAfterCancel,
    workerClaimed: workerAfterCancel.claimed,
  };

  // Campaña completa IN_APP (+ EMAIL si hay opt-in)
  const send = await confirmAndSendNearbyCampaign({
    infoSpotEventId: rosario.id,
    scope: { mode: "RADIUS_KM", km: 50 },
    actorUserId,
    actorIsDirectorOrSuperAdmin: true,
    title: `${QA_PREFIX} send-test`,
    confirmed: true,
    channels: ["IN_APP", "EMAIL"],
    campaignCycle: `qa-send-${Date.now()}`,
    runWorkerAfterQueue: true,
  });
  if (!send.ok) throw new Error(`send campaign: ${send.error}`);

  const detail = await getCampaignAdminDetail(send.campaignId);
  const emailQueueCount = await prisma.emailQueue.count({
    where: {
      idempotencyKey: { startsWith: "dnx_notif_email:" },
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  const dashCount = await prisma.dashboardNotification.count({
    where: {
      type: "DNX_NEARBY_PHOTOGRAPHER_CALL",
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  // Idempotencia worker
  const worker2 = await runNotificationWorker({ batchSize: 50 });

  report.send = {
    campaignId: send.campaignId.slice(0, 8) + "…",
    eligible: send.eligibleCount,
    queued: send.queued,
    sent: send.sent,
    failed: send.failed,
    status: detail?.campaign.status,
    deliveries: detail?.deliveries.length,
    emailQueueRecent: emailQueueCount,
    dashboardRecent: dashCount,
    workerSecondPassClaimed: worker2.claimed,
  };

  // Retry (puede ser 0 si no hubo fallos)
  const retry = await retryFailedCampaignDeliveries({
    campaignId: send.campaignId,
    actorUserId,
  });
  report.retry = retry.ok
    ? { requeued: retry.requeued, sent: retry.worker.sent, failed: retry.worker.failed }
    : { error: retry.error };

  const list = await listNotificationCampaigns({ q: QA_PREFIX });
  report.panelList = { count: list.length, statuses: [...new Set(list.map((r) => r.status))] };

  const reconcile = await reconcileNotifications({ dryRun: true });
  report.reconcile = reconcile;

  const cleanupDry = await cleanupNotificationsQa({ dryRun: true });
  report.cleanupDryRun = cleanupDry;

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

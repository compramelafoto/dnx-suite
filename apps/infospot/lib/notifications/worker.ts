/**
 * Worker outbox DNX Notifications — reclama lotes con lease y procesa IN_APP / EMAIL.
 */

import { prisma, Prisma } from "@repo/db";
import {
  resolveNextDeliveryStatus,
  resolveWorkerConfig,
  renderNearbyCallEmail,
  type NotificationWorkerConfig,
} from "@repo/notifications";
import { randomBytes } from "node:crypto";
import { reconcileCampaignMetrics } from "./metrics";
import { resolveNotificationEmailTo } from "./email-override";
import { isNotificationEmailChannelEnabled } from "./feature-flags";

export type WorkerRunResult = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  workerId: string;
};

function log(event: string, fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: "dnx_notifications_worker",
      event,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}

function publicSiteOrigin(): string {
  /* eslint-disable turbo/no-undeclared-env-vars -- URLs públicas CLF / override tracking */
  return (
    process.env.NEXT_PUBLIC_CLF_SITE_URL?.replace(/\/$/, "") ||
    process.env.CLF_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://compramelafoto.com"
  );
  /* eslint-enable turbo/no-undeclared-env-vars */
}

function trackingUrl(publicToken: string): string {
  return `${publicSiteOrigin()}/n/${encodeURIComponent(publicToken)}`;
}

function prefsUrl(): string {
  return `${publicSiteOrigin()}/fotografo/configuracion/notificaciones`;
}

/**
 * Reclama un lote PENDING (o PROCESSING con lock vencido) de campañas no canceladas.
 */
export async function claimNotificationDeliveries(
  config: NotificationWorkerConfig,
): Promise<string[]> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + config.lockTimeoutMs);

  const candidates = await prisma.dnxNotificationDelivery.findMany({
    where: {
      scheduledAt: { lte: now },
      campaign: { status: { in: ["QUEUED", "PROCESSING"] } },
      OR: [
        { status: "PENDING" },
        {
          status: "PROCESSING",
          lockExpiresAt: { lt: now },
        },
        {
          status: "FAILED",
          attempts: { lt: config.maxAttempts },
          scheduledAt: { lte: now },
          errorCode: {
            notIn: [
              "OPTED_OUT",
              "BLOCKED",
              "INVALID_RECIPIENT",
              "CHANNEL_NOT_IMPLEMENTED",
              "CANCELLED",
            ],
          },
        },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: config.batchSize,
    select: { id: true },
  });

  const claimed: string[] = [];
  for (const row of candidates) {
    const updated = await prisma.dnxNotificationDelivery.updateMany({
      where: {
        id: row.id,
        OR: [
          { status: "PENDING" },
          { status: "FAILED", attempts: { lt: config.maxAttempts } },
          {
            status: "PROCESSING",
            lockExpiresAt: { lt: now },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        lockedBy: config.workerId,
        lockExpiresAt: lockUntil,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) claimed.push(row.id);
  }
  return claimed;
}

async function deliverInApp(delivery: {
  id: string;
  userId: number;
  title: string;
  body: string;
  publicToken: string;
  dashboardNotificationId: number | null;
  campaignId: string;
}): Promise<{ ok: true; dashboardNotificationId: number } | { ok: false; errorCode: string; message: string }> {
  if (delivery.dashboardNotificationId) {
    return { ok: true, dashboardNotificationId: delivery.dashboardNotificationId };
  }

  const link = trackingUrl(delivery.publicToken);
  const existing = await prisma.dashboardNotification.findFirst({
    where: {
      userId: delivery.userId,
      type: "DNX_NEARBY_PHOTOGRAPHER_CALL",
      link,
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, dashboardNotificationId: existing.id };
  }

  const dash = await prisma.dashboardNotification.create({
    data: {
      userId: delivery.userId,
      type: "DNX_NEARBY_PHOTOGRAPHER_CALL",
      title: delivery.title,
      body: delivery.body,
      link,
    },
  });
  return { ok: true, dashboardNotificationId: dash.id };
}

async function deliverEmail(delivery: {
  id: string;
  userId: number;
  title: string;
  body: string;
  publicToken: string;
  emailQueueId: number | null;
  campaignId: string;
  citySnapshot: string | null;
  distanceKm: number | null;
}): Promise<{ ok: true; emailQueueId: number } | { ok: false; errorCode: string; message: string }> {
  if (delivery.emailQueueId) {
    return { ok: true, emailQueueId: delivery.emailQueueId };
  }

  if (!isNotificationEmailChannelEnabled()) {
    return {
      ok: false,
      errorCode: "CHANNEL_DISABLED",
      message: "Canal EMAIL deshabilitado (kill switch)",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: delivery.userId },
    select: {
      email: true,
      name: true,
      unsubscribedAt: true,
      isBlocked: true,
      dnxNotificationPreference: true,
    },
  });
  if (!user?.email || !user.email.includes("@")) {
    return { ok: false, errorCode: "INVALID_RECIPIENT", message: "Email inválido" };
  }
  if (user.isBlocked || user.unsubscribedAt) {
    return { ok: false, errorCode: "OPTED_OUT", message: "Usuario dado de baja" };
  }
  const pref = user.dnxNotificationPreference;
  // EMAIL requiere opt-in explícito (channelEmail). Sin fila de preferencias → no email.
  if (!pref?.nearbyPhotographerCalls || !pref.channelEmail) {
    return { ok: false, errorCode: "OPTED_OUT", message: "Email deshabilitado en preferencias" };
  }

  /* eslint-disable turbo/no-undeclared-env-vars -- override QA no-prod / preview */
  const emailTo = resolveNotificationEmailTo({
    recipientEmail: user.email,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    override: process.env.DNX_NOTIFICATIONS_EMAIL_OVERRIDE,
  });
  /* eslint-enable turbo/no-undeclared-env-vars */
  const to = emailTo.to;
  if (emailTo.ignoredOverrideInProduction) {
    log("email_override_ignored_in_production", {
      deliveryId: delivery.id,
      campaignId: delivery.campaignId,
    });
  } else if (emailTo.overridden) {
    log("email_override_applied", {
      deliveryId: delivery.id,
      campaignId: delivery.campaignId,
    });
  }

  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: delivery.campaignId },
    select: { centerCity: true, centerProvince: true, title: true },
  });

  const rendered = renderNearbyCallEmail({
    eventName: campaign?.title ?? delivery.title,
    city: delivery.citySnapshot ?? campaign?.centerCity,
    province: campaign?.centerProvince,
    distanceLabel:
      delivery.distanceKm != null ? `~${delivery.distanceKm} km` : null,
    body: delivery.body,
    ctaUrl: trackingUrl(delivery.publicToken),
    prefsUrl: prefsUrl(),
  });

  const idempotencyKey = `dnx_notif_email:${delivery.id}`;
  const existing = await prisma.emailQueue.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, emailQueueId: existing.id };
  }

  const queued = await prisma.emailQueue.create({
    data: {
      to,
      subject: rendered.subject,
      body: rendered.text,
      htmlBody: rendered.html,
      priority: 4,
      status: "PENDING",
      idempotencyKey,
      templateData: {
        kind: "DNX_NEARBY_PHOTOGRAPHER_CALL",
        deliveryId: delivery.id,
        campaignId: delivery.campaignId,
      } as Prisma.InputJsonValue,
    },
  });

  log("email_enqueued", {
    campaignId: delivery.campaignId,
    deliveryId: delivery.id,
    channel: "EMAIL",
    emailQueueId: queued.id,
  });

  return { ok: true, emailQueueId: queued.id };
}

async function processOne(
  deliveryId: string,
  config: NotificationWorkerConfig,
): Promise<"sent" | "failed" | "skipped"> {
  const delivery = await prisma.dnxNotificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      campaign: { select: { id: true, status: true, clfEventId: true } },
    },
  });
  if (!delivery) return "skipped";
  if (delivery.campaign.status === "CANCELLED") {
    await prisma.dnxNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "CANCELLED",
        errorCode: "CANCELLED",
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
    return "skipped";
  }
  if (delivery.lockedBy && delivery.lockedBy !== config.workerId) {
    if (delivery.lockExpiresAt && delivery.lockExpiresAt > new Date()) {
      return "skipped";
    }
  }

  try {
    let result:
      | { ok: true; dashboardNotificationId?: number; emailQueueId?: number }
      | { ok: false; errorCode: string; message: string };

    if (delivery.channel === "IN_APP") {
      result = await deliverInApp(delivery);
    } else if (delivery.channel === "EMAIL") {
      result = await deliverEmail(delivery);
    } else {
      result = {
        ok: false,
        errorCode: "CHANNEL_NOT_IMPLEMENTED",
        message: `Canal ${delivery.channel} no implementado`,
      };
    }

    if (result.ok) {
      await prisma.dnxNotificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          deliveredAt: new Date(),
          lastError: null,
          errorCode: null,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          ctaUrl: trackingUrl(delivery.publicToken),
          ...(result.dashboardNotificationId
            ? { dashboardNotificationId: result.dashboardNotificationId }
            : {}),
          ...(result.emailQueueId ? { emailQueueId: result.emailQueueId } : {}),
        },
      });

      if (delivery.channel === "IN_APP" && delivery.campaign.clfEventId) {
        await prisma.eventNearbyPhotographerNotification
          .upsert({
            where: {
              eventId_userId: {
                eventId: delivery.campaign.clfEventId,
                userId: delivery.userId,
              },
            },
            create: {
              eventId: delivery.campaign.clfEventId,
              userId: delivery.userId,
            },
            update: {},
          })
          .catch(() => undefined);
      }

      log("delivery_success", {
        campaignId: delivery.campaignId,
        deliveryId,
        channel: delivery.channel,
        attempt: delivery.attempts,
      });
      return "sent";
    }

    const next = resolveNextDeliveryStatus({
      current: "PROCESSING",
      success: false,
      attempts: delivery.attempts,
      errorCode: result.errorCode,
      maxAttempts: config.maxAttempts,
    });
    await prisma.dnxNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: next.status,
        lastError: result.message,
        errorCode: result.errorCode,
        scheduledAt: next.retryAt ?? delivery.scheduledAt,
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
    log("delivery_failed", {
      campaignId: delivery.campaignId,
      deliveryId,
      channel: delivery.channel,
      attempt: delivery.attempts,
      errorCode: result.errorCode,
      final: next.final,
    });
    return "failed";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const next = resolveNextDeliveryStatus({
      current: "PROCESSING",
      success: false,
      attempts: delivery.attempts,
      errorCode: "DELIVERY_ERROR",
      maxAttempts: config.maxAttempts,
    });
    await prisma.dnxNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: next.status,
        lastError: message,
        errorCode: "DELIVERY_ERROR",
        scheduledAt: next.retryAt ?? new Date(),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
    log("delivery_failed", {
      campaignId: delivery.campaignId,
      deliveryId,
      channel: delivery.channel,
      attempt: delivery.attempts,
      errorCode: "DELIVERY_ERROR",
    });
    return "failed";
  }
}

export async function runNotificationWorker(
  partial: Partial<NotificationWorkerConfig> = {},
): Promise<WorkerRunResult> {
  const config = resolveWorkerConfig({
    ...partial,
    workerId: partial.workerId ?? `infospot-${process.pid}-${randomBytes(3).toString("hex")}`,
  });
  log("worker_started", { workerId: config.workerId, batchSize: config.batchSize });

  const claimed = await claimNotificationDeliveries(config);
  log("batch_claimed", { workerId: config.workerId, claimed: claimed.length });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const campaignIds = new Set<string>();

  for (const id of claimed) {
    const before = await prisma.dnxNotificationDelivery.findUnique({
      where: { id },
      select: { campaignId: true },
    });
    if (before) campaignIds.add(before.campaignId);
    const outcome = await processOne(id, config);
    if (outcome === "sent") sent += 1;
    else if (outcome === "failed") failed += 1;
    else skipped += 1;
  }

  for (const campaignId of campaignIds) {
    await reconcileCampaignMetrics(campaignId);
  }

  log("worker_finished", {
    workerId: config.workerId,
    claimed: claimed.length,
    sent,
    failed,
    skipped,
  });

  return {
    claimed: claimed.length,
    sent,
    failed,
    skipped,
    workerId: config.workerId,
  };
}

/** Libera locks vencidos (reconciliación). */
export async function releaseExpiredLocks(dryRun = true): Promise<number> {
  const now = new Date();
  const stuck = await prisma.dnxNotificationDelivery.findMany({
    where: { status: "PROCESSING", lockExpiresAt: { lt: now } },
    select: { id: true },
  });
  if (dryRun) return stuck.length;
  const res = await prisma.dnxNotificationDelivery.updateMany({
    where: { status: "PROCESSING", lockExpiresAt: { lt: now } },
    data: {
      status: "FAILED",
      errorCode: "LOCK_EXPIRED",
      lastError: "Lock expirado; pendiente de reintento",
      lockedAt: null,
      lockedBy: null,
      lockExpiresAt: null,
    },
  });
  return res.count;
}

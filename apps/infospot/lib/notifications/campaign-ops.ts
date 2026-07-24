import { prisma } from "@repo/db";
import { runNotificationWorker, type WorkerRunResult } from "./worker";
import { reconcileCampaignMetrics } from "./metrics";

export async function cancelNotificationCampaign(input: {
  campaignId: string;
  actorUserId: number;
  reason?: string | null;
}): Promise<{ ok: true; cancelledPending: number } | { ok: false; error: string }> {
  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: input.campaignId },
  });
  if (!campaign) return { ok: false, error: "Campaña no encontrada." };
  if (campaign.status === "CANCELLED") {
    return { ok: false, error: "La campaña ya está cancelada." };
  }

  const cancelled = await prisma.dnxNotificationDelivery.updateMany({
    where: {
      campaignId: input.campaignId,
      status: { in: ["PENDING", "PROCESSING", "FAILED"] },
    },
    data: {
      status: "CANCELLED",
      errorCode: "CANCELLED",
      lastError: input.reason?.trim() || "Cancelada por administrador",
      lockedAt: null,
      lockedBy: null,
      lockExpiresAt: null,
    },
  });

  await prisma.dnxNotificationCampaign.update({
    where: { id: input.campaignId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: input.actorUserId,
      cancelReason: input.reason?.trim() || "Cancelada por administrador",
    },
  });

  await reconcileCampaignMetrics(input.campaignId);
  console.log(
    JSON.stringify({
      scope: "dnx_notifications_worker",
      event: "campaign_cancelled",
      campaignId: input.campaignId,
      actorUserId: input.actorUserId,
      cancelledPending: cancelled.count,
    }),
  );
  return { ok: true, cancelledPending: cancelled.count };
}

export async function retryFailedCampaignDeliveries(input: {
  campaignId: string;
  actorUserId: number;
}): Promise<
  | { ok: true; requeued: number; worker: Awaited<ReturnType<typeof runNotificationWorker>> }
  | { ok: false; error: string }
> {
  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: input.campaignId },
  });
  if (!campaign) return { ok: false, error: "Campaña no encontrada." };
  if (campaign.status === "CANCELLED") {
    return { ok: false, error: "No se pueden reintentar campañas canceladas." };
  }

  const requeued = await prisma.dnxNotificationDelivery.updateMany({
    where: {
      campaignId: input.campaignId,
      status: { in: ["FAILED", "DEAD_LETTER"] },
      attempts: { lt: 5 },
      errorCode: {
        notIn: ["OPTED_OUT", "BLOCKED", "INVALID_RECIPIENT", "CHANNEL_NOT_IMPLEMENTED", "CANCELLED"],
      },
    },
    data: {
      status: "PENDING",
      scheduledAt: new Date(),
      lastError: null,
      errorCode: null,
      lockedAt: null,
      lockedBy: null,
      lockExpiresAt: null,
    },
  });

  if (requeued.count === 0) {
    await reconcileCampaignMetrics(input.campaignId);
    const worker: WorkerRunResult = {
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      workerId: "retry-noop",
    };
    console.log(
      JSON.stringify({
        scope: "dnx_notifications_worker",
        event: "campaign_retry_noop",
        campaignId: input.campaignId,
        actorUserId: input.actorUserId,
        requeued: 0,
      }),
    );
    return { ok: true, requeued: 0, worker };
  }

  await prisma.dnxNotificationCampaign.update({
    where: { id: input.campaignId },
    data: {
      status: "QUEUED",
      retriedAt: new Date(),
      retriedByUserId: input.actorUserId,
    },
  });

  const worker = await runNotificationWorker({
    batchSize: Math.min(100, Math.max(requeued.count, 1)),
  });
  console.log(
    JSON.stringify({
      scope: "dnx_notifications_worker",
      event: "campaign_retry",
      campaignId: input.campaignId,
      actorUserId: input.actorUserId,
      requeued: requeued.count,
    }),
  );
  return { ok: true, requeued: requeued.count, worker };
}

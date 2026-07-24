/**
 * Diagnóstico / reconciliación Notifications Engine.
 * Por defecto dry-run.
 */

import { prisma } from "@repo/db";
import { reconcileCampaignMetrics } from "./metrics";
import { releaseExpiredLocks } from "./worker";

export type ReconcileReport = {
  dryRun: boolean;
  expiredLocks: number;
  releasedLocks: number;
  campaignsReconciled: number;
  orphanDeliveries: number;
  inAppWithoutDash: number;
  dashWithoutDelivery: number;
  stuckCampaigns: string[];
  attributionWithoutDelivery: number;
  attributionWithoutEventMember: number;
  attributionWrongCampaignDelivery: number;
  attributionWrongCallEvent: number;
  duplicateAttributionGroups: number;
  applicationCountMismatch: number;
  clickedWithoutAttributionCandidates: number;
  attributionWrongUser: number;
};

export async function reconcileNotifications(options?: {
  dryRun?: boolean;
  campaignId?: string;
}): Promise<ReconcileReport> {
  const dryRun = options?.dryRun !== false;
  const expiredLocks = await releaseExpiredLocks(true);
  const releasedLocks = dryRun ? 0 : await releaseExpiredLocks(false);

  const campaigns = await prisma.dnxNotificationCampaign.findMany({
    where: options?.campaignId ? { id: options.campaignId } : undefined,
    select: {
      id: true,
      status: true,
      applicationCount: true,
      clfEventId: true,
      sourceEntityId: true,
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  let campaignsReconciled = 0;
  const stuckCampaigns: string[] = [];
  let applicationCountMismatch = 0;

  for (const c of campaigns) {
    if (!dryRun) {
      await reconcileCampaignMetrics(c.id);
      campaignsReconciled += 1;
    }
    const pending = await prisma.dnxNotificationDelivery.count({
      where: {
        campaignId: c.id,
        status: { in: ["PENDING", "PROCESSING"] },
        updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (pending > 0 && c.status !== "CANCELLED") stuckCampaigns.push(c.id);

    const realApps = await prisma.dnxNotificationAttribution.count({
      where: { campaignId: c.id },
    });
    if (realApps !== c.applicationCount) {
      applicationCountMismatch += 1;
      if (!dryRun) {
        await prisma.dnxNotificationCampaign.update({
          where: { id: c.id },
          data: { applicationCount: realApps },
        });
      }
    }
  }

  // Entregas cuyo campaignId no resuelve (raro con FK); placeholder 0.
  const orphanDeliveries = 0;

  const inAppWithoutDash = await prisma.dnxNotificationDelivery.count({
    where: {
      channel: "IN_APP",
      status: "SENT",
      dashboardNotificationId: null,
    },
  });

  const sentLinks = await prisma.dnxNotificationDelivery.findMany({
    where: {
      channel: "IN_APP",
      status: "SENT",
      dashboardNotificationId: { not: null },
    },
    select: { dashboardNotificationId: true },
    take: 500,
  });
  const dashIds = sentLinks
    .map((d) => d.dashboardNotificationId)
    .filter((id): id is number => id != null);
  let dashWithoutDelivery = 0;
  if (dashIds.length) {
    const existing = await prisma.dashboardNotification.findMany({
      where: { id: { in: dashIds }, type: "DNX_NEARBY_PHOTOGRAPHER_CALL" },
      select: { id: true },
    });
    dashWithoutDelivery = Math.max(0, dashIds.length - existing.length);
  }

  const attributions = await prisma.dnxNotificationAttribution.findMany({
    where: options?.campaignId ? { campaignId: options.campaignId } : undefined,
    select: {
      id: true,
      campaignId: true,
      deliveryId: true,
      userId: true,
      clfEventId: true,
      eventMemberId: true,
      delivery: { select: { id: true, campaignId: true, userId: true } },
      campaign: {
        select: { id: true, clfEventId: true, sourceEntityId: true },
      },
    },
    take: 1000,
    orderBy: { attributedAt: "desc" },
  });

  let attributionWithoutDelivery = 0;
  let attributionWithoutEventMember = 0;
  let attributionWrongCampaignDelivery = 0;
  let attributionWrongCallEvent = 0;
  let attributionWrongUser = 0;

  for (const a of attributions) {
    if (!a.delivery) attributionWithoutDelivery += 1;
    else {
      if (a.delivery.campaignId !== a.campaignId) {
        attributionWrongCampaignDelivery += 1;
      }
      if (a.delivery.userId !== a.userId) attributionWrongUser += 1;
    }
    if (a.eventMemberId == null) attributionWithoutEventMember += 1;
    if (
      a.campaign.clfEventId != null &&
      a.campaign.clfEventId !== a.clfEventId
    ) {
      attributionWrongCallEvent += 1;
    }
  }

  const attrRows = await prisma.dnxNotificationAttribution.findMany({
    where: options?.campaignId ? { campaignId: options.campaignId } : undefined,
    select: { campaignId: true, userId: true, clfEventId: true },
    take: 2000,
  });
  const dupMap = new Map<string, number>();
  for (const r of attrRows) {
    const k = `${r.campaignId}:${r.userId}:${r.clfEventId}`;
    dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
  }
  const duplicateAttributionGroups = [...dupMap.values()].filter((n) => n > 1).length;

  // Clics SENT con cookie potencial pero sin attribution — solo candidatos, no auto-crear.
  let clickedWithoutAttributionCandidates = 0;
  for (const c of campaigns.slice(0, 50)) {
    if (c.clfEventId == null) continue;
    const clicked = await prisma.dnxNotificationDelivery.findMany({
      where: {
        campaignId: c.id,
        status: "SENT",
        clickedAt: { not: null },
      },
      select: { id: true, userId: true },
      take: 200,
    });
    for (const d of clicked) {
      const member = await prisma.eventMember.findUnique({
        where: {
          eventId_userId: { eventId: c.clfEventId, userId: d.userId },
        },
        select: { id: true },
      });
      if (!member) continue;
      const attr = await prisma.dnxNotificationAttribution.findFirst({
        where: { deliveryId: d.id },
        select: { id: true },
      });
      if (!attr) clickedWithoutAttributionCandidates += 1;
    }
  }

  return {
    dryRun,
    expiredLocks,
    releasedLocks,
    campaignsReconciled: dryRun ? 0 : campaignsReconciled,
    orphanDeliveries,
    inAppWithoutDash,
    dashWithoutDelivery,
    stuckCampaigns,
    attributionWithoutDelivery,
    attributionWithoutEventMember,
    attributionWrongCampaignDelivery,
    attributionWrongCallEvent,
    duplicateAttributionGroups,
    applicationCountMismatch,
    clickedWithoutAttributionCandidates,
    attributionWrongUser,
  };
}

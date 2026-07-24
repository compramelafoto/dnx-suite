/**
 * Consultas seguras para el panel operativo de campañas (sin PII de destinatarios).
 */

import { prisma, type Prisma } from "@repo/db";
import { computeCampaignMetrics } from "./metrics";

export type CampaignStatus =
  | "DRAFT"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type NotificationChannel = "IN_APP" | "EMAIL" | "WEB_PUSH" | "TELEGRAM" | "WHATSAPP" | "SMS";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Borrador",
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  COMPLETED: "Completada",
  FAILED: "Fallida",
  CANCELLED: "Cancelada",
};

export type CampaignListFilters = {
  status?: CampaignStatus | "";
  channel?: NotificationChannel | "";
  city?: string;
  sourceEntityId?: string;
  createdByUserId?: number | "";
  from?: string;
  to?: string;
  withFailures?: boolean;
  withPending?: boolean;
  q?: string;
};

export type CampaignListRow = {
  id: string;
  title: string;
  eventType: string;
  centerCity: string | null;
  centerProvince: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: CampaignStatus;
  channels: NotificationChannel[];
  scopeMode: string;
  radiusKm: number | null;
  audienceCount: number;
  eligibleCount: number;
  pendingCount: number;
  processingCount: number;
  sentCount: number;
  failedCount: number;
  readCount: number;
  clickCount: number;
  applicationCount: number;
  createdByName: string | null;
  createdById: number;
  clfEventId: number | null;
  ctaUrl: string;
  sourceEntityId: string;
  lastRunAt: Date | null;
};

function opaqueUserLabel(userId: number): string {
  return `u_${userId.toString(36)}`;
}

export async function listNotificationCampaigns(
  filters: CampaignListFilters,
  take = 80,
): Promise<CampaignListRow[]> {
  const where: Prisma.DnxNotificationCampaignWhereInput = {
    sourceApp: "infospot",
  };

  if (filters.status) where.status = filters.status;
  if (filters.city?.trim()) {
    where.centerCity = { contains: filters.city.trim(), mode: "insensitive" };
  }
  if (filters.sourceEntityId?.trim()) {
    where.sourceEntityId = filters.sourceEntityId.trim();
  }
  if (typeof filters.createdByUserId === "number") {
    where.createdByUserId = filters.createdByUserId;
  }
  if (filters.channel) {
    where.channels = { has: filters.channel };
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }
  if (filters.withFailures) {
    where.failedCount = { gt: 0 };
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { centerCity: { contains: q, mode: "insensitive" } },
      { id: { equals: q } },
    ];
  }

  const rows = await prisma.dnxNotificationCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      createdBy: { select: { id: true, name: true } },
      deliveries: {
        select: { status: true },
      },
    },
  });

  let mapped = rows.map((c) => {
    const pendingCount = c.deliveries.filter((d) => d.status === "PENDING").length;
    const processingCount = c.deliveries.filter((d) => d.status === "PROCESSING").length;
    return {
      id: c.id,
      title: c.title,
      eventType: c.eventType,
      centerCity: c.centerCity,
      centerProvince: c.centerProvince,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      status: c.status,
      channels: c.channels,
      scopeMode: c.scopeMode,
      radiusKm: c.radiusKm,
      audienceCount: c.audienceCount,
      eligibleCount: c.eligibleCount,
      pendingCount,
      processingCount,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      readCount: c.readCount,
      clickCount: c.clickCount,
      applicationCount: c.applicationCount,
      createdByName: c.createdBy.name,
      createdById: c.createdBy.id,
      clfEventId: c.clfEventId,
      ctaUrl: c.ctaUrl,
      sourceEntityId: c.sourceEntityId,
      lastRunAt: c.retriedAt ?? c.confirmedAt ?? c.updatedAt,
    } satisfies CampaignListRow;
  });

  if (filters.withPending) {
    mapped = mapped.filter((r) => r.pendingCount + r.processingCount > 0);
  }

  return mapped;
}

export type SafeDeliveryRow = {
  opaqueId: string;
  channel: NotificationChannel;
  status: string;
  distanceKm: number | null;
  city: string | null;
  attempts: number;
  lastError: string | null;
  read: boolean;
  clicked: boolean;
  attributed: boolean;
};

function sanitizeError(err: string | null): string | null {
  if (!err) return null;
  return err
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/nt_[A-Za-z0-9_-]+/g, "[token]")
    .slice(0, 180);
}

export async function getCampaignAdminDetail(campaignId: string) {
  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: campaignId },
    include: {
      createdBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
    },
  });
  if (!campaign) return null;

  const metrics = await computeCampaignMetrics(campaignId);
  const exclusion =
    campaign.exclusionSummaryJson && typeof campaign.exclusionSummaryJson === "object"
      ? (campaign.exclusionSummaryJson as Record<string, number>)
      : {};

  const deliveriesRaw = await prisma.dnxNotificationDelivery.findMany({
    where: { campaignId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      userId: true,
      channel: true,
      status: true,
      distanceKm: true,
      citySnapshot: true,
      attempts: true,
      lastError: true,
      readAt: true,
      clickedAt: true,
      attribution: { select: { id: true } },
    },
  });

  const deliveries: SafeDeliveryRow[] = deliveriesRaw.map((d) => ({
    opaqueId: opaqueUserLabel(d.userId),
    channel: d.channel,
    status: d.status,
    distanceKm: d.distanceKm != null ? Math.round(d.distanceKm * 10) / 10 : null,
    city: d.citySnapshot,
    attempts: d.attempts,
    lastError: sanitizeError(d.lastError),
    read: Boolean(d.readAt),
    clicked: Boolean(d.clickedAt),
    attributed: Boolean(d.attribution),
  }));

  const call = await prisma.infoSpotPhotographerCall.findUnique({
    where: { id: campaign.sourceEntityId },
    select: {
      id: true,
      eventId: true,
      publicUrl: true,
      event: { select: { title: true, slug: true, city: true } },
    },
  });

  return {
    campaign,
    metrics,
    exclusion,
    deliveries,
    call,
  };
}

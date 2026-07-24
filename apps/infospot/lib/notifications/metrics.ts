import { prisma } from "@repo/db";

export type CampaignMetricsSnapshot = {
  audience_count: number;
  eligible_count: number;
  pending_count: number;
  processing_count: number;
  sent_count: number;
  failed_count: number;
  read_count: number;
  click_count: number;
  application_count: number;
  read_rate: number | null;
  click_rate: number | null;
  application_rate: number | null;
  /** Postulaciones atribuibles / clics (null si no hay clics). */
  application_rate_on_click: number | null;
};

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

/** Etiqueta humana: "2 de 8 — 25 %" o "—" si no aplica. */
export function formatRateLabel(num: number, den: number): string {
  if (den <= 0) return "—";
  const pct = Math.round((num / den) * 1000) / 10;
  return `${num} de ${den} — ${pct} %`;
}

/** Fuente de verdad: agregados desde deliveries + attributions. */
export async function computeCampaignMetrics(
  campaignId: string,
): Promise<CampaignMetricsSnapshot> {
  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: campaignId },
    select: { audienceCount: true, eligibleCount: true },
  });
  const groups = await prisma.dnxNotificationDelivery.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const countBy = Object.fromEntries(
    groups.map((g) => [g.status, g._count._all]),
  ) as Record<string, number>;

  const read_count = await prisma.dnxNotificationDelivery.count({
    where: { campaignId, readAt: { not: null } },
  });
  const click_count = await prisma.dnxNotificationDelivery.count({
    where: { campaignId, clickedAt: { not: null } },
  });
  const application_count = await prisma.dnxNotificationAttribution.count({
    where: { campaignId },
  });

  const sent_count = countBy.SENT ?? 0;
  return {
    audience_count: campaign?.audienceCount ?? 0,
    eligible_count: campaign?.eligibleCount ?? 0,
    pending_count: countBy.PENDING ?? 0,
    processing_count: countBy.PROCESSING ?? 0,
    sent_count,
    failed_count: (countBy.FAILED ?? 0) + (countBy.DEAD_LETTER ?? 0),
    read_count,
    click_count,
    application_count,
    read_rate: rate(read_count, sent_count),
    click_rate: rate(click_count, sent_count),
    application_rate: rate(application_count, sent_count),
    application_rate_on_click: rate(application_count, click_count),
  };
}

export async function reconcileCampaignMetrics(campaignId: string): Promise<CampaignMetricsSnapshot> {
  const m = await computeCampaignMetrics(campaignId);
  const pendingLeft = m.pending_count + m.processing_count;
  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  let status = campaign?.status;
  if (status !== "CANCELLED" && status !== "DRAFT") {
    if (pendingLeft === 0 && m.sent_count + m.failed_count > 0) {
      status = m.sent_count === 0 ? "FAILED" : "COMPLETED";
    } else if (pendingLeft > 0) {
      status = "PROCESSING";
    }
  }

  await prisma.dnxNotificationCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: m.sent_count,
      failedCount: m.failed_count,
      readCount: m.read_count,
      clickCount: m.click_count,
      applicationCount: m.application_count,
      ...(status ? { status } : {}),
    },
  });
  return m;
}

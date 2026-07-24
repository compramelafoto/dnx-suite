/**
 * Verifica attribution + applicationCount tras E2E UI.
 *
 *   pnpm --filter infospot notifications:qa-verify-attribution
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@repo/db";
import { computeCampaignMetrics } from "../lib/notifications/metrics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const attrPath = resolve(root, ".qa-artifacts/notifications-qa-attribution.json");

async function main() {
  if (!existsSync(attrPath)) throw new Error("Falta notifications-qa-attribution.json");
  const f = JSON.parse(readFileSync(attrPath, "utf8")) as {
    campaignId: string;
    deliveryId: string;
    userId: number;
    clfEventId: number;
  };

  const attr = await prisma.dnxNotificationAttribution.findUnique({
    where: { deliveryId: f.deliveryId },
  });
  const metrics = await computeCampaignMetrics(f.campaignId);
  const campaign = await prisma.dnxNotificationCampaign.findUnique({
    where: { id: f.campaignId },
    select: { applicationCount: true },
  });

  const report = {
    attributed: Boolean(attr),
    attributionUserMatch: attr?.userId === f.userId,
    attributionEventMatch: attr?.clfEventId === f.clfEventId,
    applicationCount: campaign?.applicationCount ?? null,
    metricsApplicationCount: metrics.application_count,
    countsMatch:
      (campaign?.applicationCount ?? -1) === metrics.application_count,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.attributed || !report.countsMatch) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

/**
 * Seed primera campaña real Vicario + publish multi-DB (ops).
 * Uso:
 *   DATABASE_URL=... DIRECT_URL=... \
 *   DNX_PARTNERS_INFOSPOT_DATABASE_URL=... \
 *   DNX_PARTNERS_CLF_DATABASE_URL=... \
 *   pnpm --filter clickaton exec tsx scripts/partners-seed-vicario-ads-imp02.ts
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { ensureAdPlacementCatalog } from "@repo/db/partners-ads-loader";
import { publishCampaignToApps, setCampaignPublishTargets } from "../lib/admin/partners/campaign-publication";

const VICARIO_ID = "cmsip1cf1001eits37kqtkyx6";

async function main() {
  await ensureAdPlacementCatalog(prisma);
  const partner = await prisma.dnxPartner.findUnique({ where: { id: VICARIO_ID } });
  if (!partner) throw new Error("Vicario no encontrado");
  if (!partner.websiteUrl) throw new Error("Vicario sin websiteUrl");

  const asset =
    (await prisma.dnxPartnerAsset.findFirst({
      where: {
        partnerId: VICARIO_ID,
        archivedAt: null,
        approvalStatus: "APPROVED",
        fileUrl: { not: null },
        type: {
          in: ["LOGO_PRIMARY", "LOGO_GENERAL", "LOGO_HORIZONTAL", "LOGO_LIGHT", "LOGO_DARK"],
        },
      },
      orderBy: { updatedAt: "desc" },
    })) ||
    (await prisma.dnxPartnerAsset.findFirst({
      where: {
        partnerId: VICARIO_ID,
        archivedAt: null,
        approvalStatus: "APPROVED",
        fileUrl: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    }));
  if (!asset?.fileUrl) throw new Error("Vicario sin asset aprobado");

  let campaign = await prisma.dnxPartnerCampaign.findFirst({
    where: { partnerId: VICARIO_ID, name: "Vicario — Nos acompañan", archivedAt: null },
  });
  if (!campaign) {
    campaign = await prisma.dnxPartnerCampaign.create({
      data: {
        id: randomUUID(),
        partnerId: VICARIO_ID,
        name: "Vicario — Nos acompañan",
        description: "Primera activación ads Partners (marquee) InfoSpot + CLF",
        application: "INFO_SPOT",
        status: "ACTIVE",
        priority: 10,
        destinationUrl: partner.websiteUrl,
        trackingEnabled: true,
        geoScope: "GLOBAL",
        updatedAt: new Date(),
      },
    });
  } else if (campaign.status !== "ACTIVE") {
    campaign = await prisma.dnxPartnerCampaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE", updatedAt: new Date() },
    });
  }

  await prisma.dnxPartnerCampaignContextTarget.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.dnxPartnerCampaignContextTarget.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      category: "PHOTOGRAPHY",
    },
  });

  let creative = await prisma.dnxPartnerCampaignCreative.findFirst({
    where: { campaignId: campaign.id, archivedAt: null, format: "LOGO_MARQUEE" },
  });
  if (!creative) {
    creative = await prisma.dnxPartnerCampaignCreative.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        assetId: asset.id,
        format: "LOGO_MARQUEE",
        deviceTarget: "ALL",
        status: "APPROVED",
        sortOrder: 10,
        destinationUrl: partner.websiteUrl,
        updatedAt: new Date(),
      },
    });
  } else if (creative.status !== "APPROVED") {
    await prisma.dnxPartnerCampaignCreative.update({
      where: { id: creative.id },
      data: { status: "APPROVED", assetId: asset.id, updatedAt: new Date() },
    });
  }

  for (const [application, placementKey] of [
    ["INFO_SPOT", "INFOSPOT_HOME_MARQUEE"],
    ["COMPRAME_LA_FOTO", "CLF_LOGO_MARQUEE"],
  ] as const) {
    const placement = await prisma.dnxPartnerAdPlacement.findUnique({
      where: { application_placementKey: { application, placementKey } },
    });
    if (!placement) throw new Error(`Placement faltante ${placementKey}`);
    await prisma.dnxPartnerCampaignPlacement.upsert({
      where: {
        campaignId_adPlacementId: {
          campaignId: campaign.id,
          adPlacementId: placement.id,
        },
      },
      create: {
        id: randomUUID(),
        campaignId: campaign.id,
        adPlacementId: placement.id,
        priority: 10,
        isActive: true,
        updatedAt: new Date(),
      },
      update: { isActive: true, priority: 10, updatedAt: new Date() },
    });
  }

  await setCampaignPublishTargets({
    campaignId: campaign.id,
    applications: ["INFO_SPOT", "COMPRAME_LA_FOTO"],
  });

  const results = await publishCampaignToApps({
    campaignId: campaign.id,
    applications: ["INFO_SPOT", "COMPRAME_LA_FOTO"],
  });

  console.log(
    JSON.stringify(
      {
        partnerId: VICARIO_ID,
        campaignId: campaign.id,
        creativeId: creative.id,
        assetId: asset.id,
        destinationUrl: partner.websiteUrl,
        results,
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
  .finally(async () => {
    await prisma.$disconnect();
  });

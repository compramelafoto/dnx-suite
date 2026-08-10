/**
 * Loader público de creatives elegibles por placement (InfoSpot / CLF).
 * Soft-read. No crea clicks (eso es /r/).
 */
import type { PrismaClient } from "@prisma/client";
import {
  AD_PLACEMENT_CATALOG,
  getAdPlacementCatalogEntry,
  isClfPartnerAdsEnabled,
  isInfospotPartnerAdsEnabled,
  partnerRedirectPath,
  resolveEligibleAds,
  type CampaignGeoAudience,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerApplication,
  type DnxPartnerCampaignContextCategory,
  type DnxPartnerCreativeDeviceTarget,
  type ResolvedAdCreative,
  type ResolveAdsCandidate,
} from "@repo/partners";

export type LoadPartnerAdsInput = {
  application: Extract<DnxPartnerApplication, "INFO_SPOT" | "COMPRAME_LA_FOTO">;
  placementKey: DnxPartnerAdPlacementKey;
  device?: DnxPartnerCreativeDeviceTarget;
  audience?: CampaignGeoAudience | null;
  audienceCategories?: readonly DnxPartnerCampaignContextCategory[] | null;
  /** Día UTC para seed de rotación. */
  rotationDayKey?: string;
};

export async function ensureAdPlacementCatalog(prisma: PrismaClient): Promise<void> {
  for (const entry of AD_PLACEMENT_CATALOG) {
    await prisma.dnxPartnerAdPlacement.upsert({
      where: {
        application_placementKey: {
          application: entry.application,
          placementKey: entry.placementKey,
        },
      },
      create: {
        application: entry.application,
        placementKey: entry.placementKey,
        name: entry.name,
        description: entry.description,
        allowedFormats: [...entry.allowedFormats],
        deviceSupport: entry.deviceSupport,
        maxItems: entry.maxItems,
        rotationMode: entry.rotationMode,
        trackingPlacement: entry.trackingPlacement,
        isActive: entry.isActiveDefault,
      },
      update: {
        name: entry.name,
        description: entry.description,
        allowedFormats: [...entry.allowedFormats],
        deviceSupport: entry.deviceSupport,
        maxItems: entry.maxItems,
        rotationMode: entry.rotationMode,
        trackingPlacement: entry.trackingPlacement,
        // no forzar isActive en update (ops puede desactivar)
      },
    });
  }
}

export async function loadPartnerAdsForPlacement(
  prisma: PrismaClient,
  input: LoadPartnerAdsInput,
): Promise<ResolvedAdCreative[]> {
  if (input.application === "INFO_SPOT" && !isInfospotPartnerAdsEnabled()) return [];
  if (input.application === "COMPRAME_LA_FOTO" && !isClfPartnerAdsEnabled()) return [];

  const catalog = getAdPlacementCatalogEntry(input.application, input.placementKey);
  if (!catalog) return [];

  let placement = await prisma.dnxPartnerAdPlacement.findUnique({
    where: {
      application_placementKey: {
        application: input.application,
        placementKey: input.placementKey,
      },
    },
  });

  if (!placement) {
    try {
      await ensureAdPlacementCatalog(prisma);
      placement = await prisma.dnxPartnerAdPlacement.findUnique({
        where: {
          application_placementKey: {
            application: input.application,
            placementKey: input.placementKey,
          },
        },
      });
    } catch {
      return [];
    }
  }

  if (!placement?.isActive) return [];

  const bindings = await prisma.dnxPartnerCampaignPlacement.findMany({
    where: {
      adPlacementId: placement.id,
      isActive: true,
      campaign: {
        status: "ACTIVE",
        archivedAt: null,
        partner: { status: { not: "ARCHIVED" }, archivedAt: null },
        // Multi-app: home `application` o target ACTIVE (aditivo).
        OR: [
          { application: input.application },
          {
            publishTargets: {
              some: { application: input.application, status: "ACTIVE" },
            },
          },
        ],
      },
    },
    include: {
      campaign: {
        include: {
          partner: { select: { id: true, name: true, status: true, archivedAt: true } },
          geoTargets: true,
          contextTargets: true,
          creatives: {
            where: { archivedAt: null, status: "APPROVED" },
            include: {
              asset: {
                select: {
                  fileUrl: true,
                  storageKey: true,
                  approvalStatus: true,
                  status: true,
                  archivedAt: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { priority: "asc" },
  });

  const candidates: ResolveAdsCandidate[] = [];
  for (const binding of bindings) {
    const campaign = binding.campaign;
    for (const creative of campaign.creatives) {
      const assetOk =
        creative.asset.approvalStatus === "APPROVED" &&
        creative.asset.status === "ACTIVE" &&
        !creative.asset.archivedAt;
      const imageUrl = creative.asset.fileUrl?.trim() || null;
      const dest =
        creative.destinationUrl?.trim() ||
        campaign.destinationUrl?.trim() ||
        null;
      candidates.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        partnerId: campaign.partner.id,
        partnerName: campaign.partner.name,
        partnerArchived:
          campaign.partner.status === "ARCHIVED" || Boolean(campaign.partner.archivedAt),
        campaignStatus: campaign.status,
        campaignStartsAt: campaign.startsAt,
        campaignEndsAt: campaign.endsAt,
        campaignArchivedAt: campaign.archivedAt,
        campaignPriority: campaign.priority,
        geoScope: campaign.geoScope,
        geoTargets: campaign.geoTargets.map((g) => ({
          countryCode: g.countryCode,
          province: g.province,
          city: g.city,
          include: g.include,
        })),
        contextTargets: campaign.contextTargets.map((c) => c.category),
        creative: {
          id: creative.id,
          format: creative.format,
          deviceTarget: creative.deviceTarget,
          title: creative.title,
          body: creative.body,
          ctaText: creative.ctaText,
          status: creative.status,
          startsAt: creative.startsAt,
          endsAt: creative.endsAt,
          archivedAt: creative.archivedAt,
          sortOrder: creative.sortOrder,
          imageUrl,
          href: dest,
          assetApproved: assetOk,
        },
        placementPriority: binding.priority,
        trackingPlacement: placement.trackingPlacement,
        allowedFormats: placement.allowedFormats,
      });
    }
  }

  const device = input.device ?? "ALL";
  const day =
    input.rotationDayKey ?? new Date().toISOString().slice(0, 10);
  const resolved = resolveEligibleAds({
    candidates,
    audience: input.audience,
    audienceCategories: input.audienceCategories,
    device,
    maxItems: placement.maxItems,
    rotationMode: placement.rotationMode,
    rotationSeed: `${input.placementKey}:${day}`,
  });

  // Enriquecer href con outbound tracking si existe (best-effort).
  const out: ResolvedAdCreative[] = [];
  for (const ad of resolved) {
    let href = ad.href;
    if (href && !href.startsWith("/r/")) {
      try {
        const link = await prisma.dnxPartnerOutboundLink.findFirst({
          where: {
            partnerId: ad.partnerId,
            application: input.application,
            placement: placement.trackingPlacement,
            status: "ACTIVE",
            archivedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          select: { trackingKey: true },
        });
        if (link?.trackingKey) href = partnerRedirectPath(link.trackingKey);
      } catch {
        // keep direct href
      }
    }
    out.push({ ...ad, href });
  }
  return out;
}

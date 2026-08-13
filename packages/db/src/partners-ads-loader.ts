/**
 * Loader público de creatives elegibles por placement
 * (InfoSpot / CLF / Clickatón welcome+marquee / FotoRank welcome).
 * Soft-read. No crea clicks (eso es /r/).
 */
import type { PrismaClient } from "@prisma/client";
import {
  AD_PLACEMENT_CATALOG,
  getAdPlacementCatalogEntry,
  isClfPartnerAdsEnabled,
  isClfPartnerAlbumWelcomeEnabled,
  isClickatonEventMarqueeEnabled,
  isClickatonHomeMarqueeEnabled,
  isClickatonPartnerWelcomeEnabled,
  isFotorankPartnerWelcomeEnabled,
  isInfospotPartnerAdsEnabled,
  isPartnerCampaignEligibleForAlbumContext,
  isPartnerCampaignEligibleForContestContext,
  isPartnerCampaignEligibleForEditionContext,
  isPartnerCampaignEligibleForScopeContext,
  isWelcomeActivationPlacementKey,
  partnerRedirectPath,
  resolveEligibleAds,
  buildWelcomeResponsiveMediaSnapshot,
  inferWelcomeCampaignSelection,
  type CampaignGeoAudience,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerApplication,
  type DnxPartnerCampaignContextCategory,
  type DnxPartnerCreativeDeviceTarget,
  type PartnerCampaignScopeContext,
  type ResolvedAdCreative,
  type ResolveAdsCandidate,
  type WelcomeGraphicAssetLike,
} from "@repo/partners";

export type LoadPartnerAdsInput = {
  application: Extract<
    DnxPartnerApplication,
    "INFO_SPOT" | "COMPRAME_LA_FOTO" | "CLICKATON" | "FOTO_RANK"
  >;
  placementKey: DnxPartnerAdPlacementKey;
  device?: DnxPartnerCreativeDeviceTarget;
  audience?: CampaignGeoAudience | null;
  audienceCategories?: readonly DnxPartnerCampaignContextCategory[] | null;
  /** Día UTC para seed de rotación. */
  rotationDayKey?: string;
  /**
   * Clickatón EVENT welcome: ID canónico de edición.
   * Compat Etapa 3 — equivalente a scope EDITION.
   */
  editionContextId?: string | null;
  /**
   * FotoRank CONTEST welcome: ID canónico del concurso (`FotorankContest.id`).
   */
  contestContextId?: string | null;
  /**
   * CLF ALBUM welcome: ID canónico del álbum (`String(Album.id)`).
   */
  albumContextId?: string | null;
  /** Welcome: exigir partner ACTIVE (default false = comportamiento IS/CLF previo). */
  requireActivePartner?: boolean;
};

function isAdsKillSwitchOff(
  application: LoadPartnerAdsInput["application"],
  placementKey: DnxPartnerAdPlacementKey,
): boolean {
  if (application === "INFO_SPOT") return !isInfospotPartnerAdsEnabled();
  if (application === "COMPRAME_LA_FOTO") {
    if (!isClfPartnerAdsEnabled()) return true;
    if (placementKey === "CLF_ALBUM_WELCOME" && !isClfPartnerAlbumWelcomeEnabled()) {
      return true;
    }
    return false;
  }
  if (application === "CLICKATON") {
    if (isWelcomeActivationPlacementKey(placementKey)) {
      return !isClickatonPartnerWelcomeEnabled();
    }
    if (placementKey === "CLICKATON_HOME_MARQUEE") {
      return !isClickatonHomeMarqueeEnabled();
    }
    if (placementKey === "CLICKATON_EVENT_MARQUEE") {
      return !isClickatonEventMarqueeEnabled();
    }
    return true;
  }
  if (application === "FOTO_RANK") return !isFotorankPartnerWelcomeEnabled();
  return true;
}

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
      },
    });
  }
}

function passesScopeFilter(input: {
  application: LoadPartnerAdsInput["application"];
  placementKey: DnxPartnerAdPlacementKey;
  editionId: string | null;
  contestId: string | null;
  albumId: string | null;
  participation: PartnerCampaignScopeContext | null;
}): boolean {
  const { application, placementKey, editionId, contestId, albumId, participation } = input;

  if (application === "CLICKATON") {
    // Slider portada: solo GLOBAL/PLATFORM explícito (null ≠ global).
    if (placementKey === "CLICKATON_HOME_MARQUEE") {
      return isPartnerCampaignEligibleForScopeContext({
        application: "CLICKATON",
        scopeKind: "EDITION",
        scopeId: "__clickaton_home__",
        participation,
        treatNullParticipationAsGlobal: false,
      });
    }
    // Slider evento: edición actual + global/platform explícito; rechaza huérfanas.
    if (placementKey === "CLICKATON_EVENT_MARQUEE") {
      if (!editionId) return false;
      return isPartnerCampaignEligibleForScopeContext({
        application: "CLICKATON",
        scopeKind: "EDITION",
        scopeId: editionId,
        participation,
        treatNullParticipationAsGlobal: false,
      });
    }
    if (editionId) {
      return isPartnerCampaignEligibleForEditionContext({
        editionId,
        participation,
      });
    }
    // Welcome home legacy: solo globales históricos (null participation).
    return participation == null;
  }

  if (application === "FOTO_RANK") {
    if (contestId) {
      return isPartnerCampaignEligibleForContestContext({
        contestId,
        participation,
      });
    }
    // Sin contestId: solo GLOBAL/PLATFORM explícito (null ≠ global).
    return isPartnerCampaignEligibleForContestContext({
      contestId: "__none__",
      participation,
    });
  }

  if (application === "COMPRAME_LA_FOTO" && placementKey === "CLF_ALBUM_WELCOME") {
    if (albumId) {
      return isPartnerCampaignEligibleForAlbumContext({
        albumId,
        participation,
      });
    }
    return isPartnerCampaignEligibleForAlbumContext({
      albumId: "__none__",
      participation,
    });
  }

  // Otros placements CLF (HOME_PROMO, GALLERY_*, etc.): sin filtro de álbum.
  return true;
}

export async function loadPartnerAdsForPlacement(
  prisma: PrismaClient,
  input: LoadPartnerAdsInput,
): Promise<ResolvedAdCreative[]> {
  if (isAdsKillSwitchOff(input.application, input.placementKey)) return [];

  // Clickatón: welcome + marquees montados. FotoRank: solo welcome (marquees aún no).
  if (input.application === "CLICKATON") {
    const allowed =
      isWelcomeActivationPlacementKey(input.placementKey) ||
      input.placementKey === "CLICKATON_HOME_MARQUEE" ||
      input.placementKey === "CLICKATON_EVENT_MARQUEE";
    if (!allowed) return [];
  } else if (input.application === "FOTO_RANK") {
    if (!isWelcomeActivationPlacementKey(input.placementKey)) return [];
  }

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

  const partnerStatusFilter = input.requireActivePartner
    ? { status: "ACTIVE" as const, archivedAt: null }
    : { status: { not: "ARCHIVED" as const }, archivedAt: null };

  const bindings = await prisma.dnxPartnerCampaignPlacement.findMany({
    where: {
      adPlacementId: placement.id,
      isActive: true,
      campaign: {
        status: "ACTIVE",
        archivedAt: null,
        partner: partnerStatusFilter,
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
          participation: {
            select: {
              id: true,
              application: true,
              contextType: true,
              contextId: true,
              status: true,
              archivedAt: true,
              publicVisibility: true,
              startsAt: true,
              endsAt: true,
            },
          },
          geoTargets: true,
          contextTargets: true,
          creatives: {
            where: { archivedAt: null, status: "APPROVED" },
            include: {
              asset: {
                select: {
                  id: true,
                  type: true,
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

  const editionId = input.editionContextId?.trim() || null;
  const contestId = input.contestContextId?.trim() || null;
  const albumId = input.albumContextId?.trim() || null;

  const welcomeCreativeRefs: Array<{
    campaignId: string;
    format: string;
    deviceTarget: string;
    status: string;
    archivedAt: Date | null;
    assetId: string;
  }> = [];

  const candidates: ResolveAdsCandidate[] = [];
  for (const binding of bindings) {
    const campaign = binding.campaign;
    const participation = campaign.participation as PartnerCampaignScopeContext | null;

    if (
      !passesScopeFilter({
        application: input.application,
        placementKey: input.placementKey,
        editionId,
        contestId,
        albumId,
        participation,
      })
    ) {
      continue;
    }

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
      if (creative.format === "WELCOME_INTERSTITIAL") {
        welcomeCreativeRefs.push({
          campaignId: campaign.id,
          format: creative.format,
          deviceTarget: creative.deviceTarget,
          status: creative.status,
          archivedAt: creative.archivedAt,
          assetId: creative.assetId,
        });
      }
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
  const day = input.rotationDayKey ?? new Date().toISOString().slice(0, 10);
  const scopeSeed = albumId ?? contestId ?? editionId ?? "";
  const resolved = resolveEligibleAds({
    candidates,
    audience: input.audience,
    audienceCategories: input.audienceCategories,
    device,
    maxItems:
      input.application === "FOTO_RANK" ||
      (input.application === "CLICKATON" &&
        isWelcomeActivationPlacementKey(input.placementKey)) ||
      input.placementKey === "CLF_ALBUM_WELCOME"
        ? 1
        : Math.max(1, placement.maxItems),
    rotationMode: placement.rotationMode,
    rotationSeed: `${input.placementKey}:${day}${scopeSeed ? `:${scopeSeed}` : ""}`,
  });

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

    let welcomeMedia: ResolvedAdCreative["welcomeMedia"] = null;
    if (ad.format === "WELCOME_INTERSTITIAL") {
      try {
        const brandAssets = await prisma.dnxPartnerAsset.findMany({
          where: {
            partnerId: ad.partnerId,
            archivedAt: null,
            status: "ACTIVE",
          },
          select: {
            id: true,
            partnerId: true,
            type: true,
            status: true,
            approvalStatus: true,
            archivedAt: true,
            fileUrl: true,
            mimeType: true,
            fileSize: true,
            width: true,
            height: true,
            altText: true,
            isPrimary: true,
            metadata: true,
          },
        });
        const logo =
          brandAssets.find(
            (a) =>
              (a.type === "LOGO_GENERAL" || a.type === "LOGO_PRIMARY") &&
              a.approvalStatus === "APPROVED" &&
              a.fileUrl,
          ) ?? brandAssets.find((a) => a.isPrimary && a.approvalStatus === "APPROVED" && a.fileUrl);
        const selection = inferWelcomeCampaignSelection({
          creatives: welcomeCreativeRefs.filter((c) => c.campaignId === ad.campaignId),
          assets: brandAssets as WelcomeGraphicAssetLike[],
          logoAssetId: logo?.id ?? null,
        });
        const snap = buildWelcomeResponsiveMediaSnapshot({
          assets: brandAssets as WelcomeGraphicAssetLike[],
          logoAsset: logo as WelcomeGraphicAssetLike | null,
          selectedDesktopId: selection.selectedDesktopId,
          selectedMobileId: selection.selectedMobileId,
          forceLogoDesktop: selection.forceLogoDesktop,
          forceLogoMobile: selection.forceLogoMobile,
          legacyImageUrl: ad.imageUrl,
          legacyAlt: ad.title,
        });
        welcomeMedia = snap.snapshot;
      } catch {
        welcomeMedia = null;
      }
    }

    out.push({ ...ad, href, welcomeMedia });
  }
  return out;
}

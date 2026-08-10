import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import {
  publishPartnerCampaignToApplication,
  publishPartnerCampaignToApplications,
} from "@repo/db/partners-campaign-publisher";
import { getPartnersPublicationTargetInfo } from "@repo/db/partners-publication-targets";
import {
  buildTrackingKey,
  computeCampaignPublicationContentHash,
  resolvePublicationDatabaseKey,
  resolvePublicationFreshness,
  type DnxPartnerApplication,
  type PartnerCampaignPublicationSnapshot,
  type PublishPartnerCampaignResult,
} from "@repo/partners";
import { ensureAdPlacementCatalog } from "@repo/db/partners-ads-loader";

export async function loadCampaignPublicationSnapshot(
  campaignId: string,
): Promise<PartnerCampaignPublicationSnapshot | null> {
  const campaign = await prisma.dnxPartnerCampaign.findUnique({
    where: { id: campaignId },
    include: {
      partner: true,
      creatives: { where: { archivedAt: null } },
      geoTargets: true,
      contextTargets: true,
      placementBindings: {
        include: { adPlacement: true },
      },
    },
  });
  if (!campaign) return null;

  const assetIds = [...new Set(campaign.creatives.map((c) => c.assetId))];
  const assets = await prisma.dnxPartnerAsset.findMany({
    where: { partnerId: campaign.partnerId, id: { in: assetIds }, archivedAt: null },
  });

  const trackingPlacements = [
    ...new Set(campaign.placementBindings.map((b) => b.adPlacement.trackingPlacement)),
  ];
  const outboundLinks = await prisma.dnxPartnerOutboundLink.findMany({
    where: {
      partnerId: campaign.partnerId,
      archivedAt: null,
      status: "ACTIVE",
      OR: [
        { placement: { in: trackingPlacements } },
        { placement: "LOGO" },
        { placement: "LOGO_MARQUEE" },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  const p = campaign.partner;
  return {
    partner: {
      id: p.id,
      name: p.name,
      legalName: p.legalName,
      slug: p.slug,
      description: p.description,
      type: p.type,
      status: p.status,
      logoUrl: p.logoUrl,
      websiteUrl: p.websiteUrl,
      instagram: p.instagram,
      facebookUrl: p.facebookUrl,
      linkedinUrl: p.linkedinUrl,
      city: p.city,
      provinceOrState: p.provinceOrState,
      country: p.country,
      archivedAt: p.archivedAt,
    },
    campaign: {
      id: campaign.id,
      partnerId: campaign.partnerId,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      priority: campaign.priority,
      destinationUrl: campaign.destinationUrl,
      trackingEnabled: campaign.trackingEnabled,
      geoScope: campaign.geoScope,
      archivedAt: campaign.archivedAt,
    },
    creatives: campaign.creatives.map((c) => ({
      id: c.id,
      campaignId: c.campaignId,
      assetId: c.assetId,
      format: c.format,
      deviceTarget: c.deviceTarget,
      title: c.title,
      body: c.body,
      ctaText: c.ctaText,
      destinationUrl: c.destinationUrl,
      status: c.status,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      sortOrder: c.sortOrder,
      archivedAt: c.archivedAt,
    })),
    assets: assets.map((a) => ({
      id: a.id,
      partnerId: a.partnerId,
      type: a.type,
      name: a.name,
      description: a.description,
      storageProvider: a.storageProvider,
      storageKey: a.storageKey,
      fileUrl: a.fileUrl,
      mimeType: a.mimeType,
      fileExtension: a.fileExtension,
      fileSize: a.fileSize,
      width: a.width,
      height: a.height,
      aspectRatio: a.aspectRatio,
      backgroundType: a.backgroundType,
      isPrimary: a.isPrimary,
      status: a.status,
      approvalStatus: a.approvalStatus,
      altText: a.altText,
      archivedAt: a.archivedAt,
    })),
    geoTargets: campaign.geoTargets.map((g) => ({
      id: g.id,
      countryCode: g.countryCode,
      province: g.province,
      city: g.city,
      include: g.include,
    })),
    contextTargets: campaign.contextTargets.map((t) => t.category),
    placementBindings: campaign.placementBindings.map((b) => ({
      id: b.id,
      placementKey: b.adPlacement.placementKey,
      priority: b.priority,
      isActive: b.isActive,
      trackingPlacement: b.adPlacement.trackingPlacement,
      rotationMode: b.adPlacement.rotationMode,
      maxItems: b.adPlacement.maxItems,
    })),
    outboundLinks: outboundLinks.map((o) => ({
      id: o.id,
      trackingKey: o.trackingKey,
      application: o.application,
      placement: o.placement,
      destinationUrl: o.destinationUrl,
      utmSource: o.utmSource,
      utmMedium: o.utmMedium,
      utmCampaign: o.utmCampaign,
      utmContent: o.utmContent,
      status: o.status,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      archivedAt: o.archivedAt,
    })),
  };
}

async function auditPublication(input: {
  partnerId: string;
  campaignId: string;
  action: string;
  summary: string;
  actorUserId?: number | null;
  afterJson?: unknown;
}) {
  try {
    await prisma.dnxPartnerAuditEvent.create({
      data: {
        id: randomUUID(),
        partnerId: input.partnerId,
        entityType: "CAMPAIGN",
        entityId: input.campaignId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        summary: input.summary,
        afterJson: input.afterJson as never,
      },
    });
  } catch {
    // best-effort
  }
}

export async function setCampaignPublishTargets(input: {
  campaignId: string;
  applications: DnxPartnerApplication[];
  actorUserId?: number | null;
}) {
  const campaign = await prisma.dnxPartnerCampaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, partnerId: true },
  });
  if (!campaign) throw new Error("Campaña no encontrada");

  const wanted = new Set(input.applications);
  const existing = await prisma.dnxPartnerCampaignTarget.findMany({
    where: { campaignId: input.campaignId },
  });

  for (const row of existing) {
    if (!wanted.has(row.application as DnxPartnerApplication)) {
      await prisma.dnxPartnerCampaignTarget.delete({ where: { id: row.id } });
      await auditPublication({
        partnerId: campaign.partnerId,
        campaignId: campaign.id,
        action: "publication_target_removed",
        summary: `Target removido: ${row.application}`,
        actorUserId: input.actorUserId,
      });
    }
  }

  for (const application of wanted) {
    if (!resolvePublicationDatabaseKey(application)) continue;
    await prisma.dnxPartnerCampaignTarget.upsert({
      where: {
        campaignId_application: { campaignId: input.campaignId, application },
      },
      create: {
        id: randomUUID(),
        campaignId: input.campaignId,
        application,
        status: "ACTIVE",
        updatedAt: new Date(),
      },
      update: { updatedAt: new Date() },
    });
    await auditPublication({
      partnerId: campaign.partnerId,
      campaignId: campaign.id,
      action: "publication_target_added",
      summary: `Target agregado: ${application}`,
      actorUserId: input.actorUserId,
    });
  }
}

export async function setCampaignTargetPublicationStatus(input: {
  campaignId: string;
  application: DnxPartnerApplication;
  status: "ACTIVE" | "PAUSED";
  actorUserId?: number | null;
}) {
  const campaign = await prisma.dnxPartnerCampaign.findUnique({
    where: { id: input.campaignId },
    select: { partnerId: true },
  });
  if (!campaign) throw new Error("Campaña no encontrada");

  await prisma.dnxPartnerCampaignTarget.upsert({
    where: {
      campaignId_application: {
        campaignId: input.campaignId,
        application: input.application,
      },
    },
    create: {
      id: randomUUID(),
      campaignId: input.campaignId,
      application: input.application,
      status: input.status,
      updatedAt: new Date(),
    },
    update: { status: input.status, updatedAt: new Date() },
  });

  await auditPublication({
    partnerId: campaign.partnerId,
    campaignId: input.campaignId,
    action: input.status === "PAUSED" ? "publication_target_paused" : "publication_target_resumed",
    summary: `${input.application} → ${input.status}`,
    actorUserId: input.actorUserId,
  });
}

async function ensureOutboundForMarquee(
  campaignId: string,
  applications: DnxPartnerApplication[],
) {
  const campaign = await prisma.dnxPartnerCampaign.findUnique({
    where: { id: campaignId },
    include: { partner: { select: { id: true, slug: true, websiteUrl: true } } },
  });
  if (!campaign) return;
  const dest =
    campaign.destinationUrl?.trim() ||
    campaign.partner.websiteUrl?.trim() ||
    null;
  if (!dest) return;

  for (const application of applications) {
    const existing = await prisma.dnxPartnerOutboundLink.findFirst({
      where: {
        partnerId: campaign.partnerId,
        application,
        placement: "LOGO_MARQUEE",
        archivedAt: null,
        status: "ACTIVE",
      },
    });
    if (existing) {
      if (existing.destinationUrl !== dest) {
        await prisma.dnxPartnerOutboundLink.update({
          where: { id: existing.id },
          data: { destinationUrl: dest, updatedAt: new Date() },
        });
      }
      continue;
    }

    await prisma.dnxPartnerOutboundLink.create({
      data: {
        id: randomUUID(),
        trackingKey: buildTrackingKey(campaign.partner.slug),
        partnerId: campaign.partnerId,
        application,
        placement: "LOGO_MARQUEE",
        destinationUrl: dest,
        utmSource: "dnx-partners",
        utmMedium: "partner",
        utmCampaign: "logo-marquee",
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    });
  }
}

export async function publishCampaignToApps(input: {
  campaignId: string;
  applications?: DnxPartnerApplication[];
  actorUserId?: number | null;
}): Promise<PublishPartnerCampaignResult[]> {
  await ensureAdPlacementCatalog(prisma);

  const targets =
    input.applications ??
    (
      await prisma.dnxPartnerCampaignTarget.findMany({
        where: { campaignId: input.campaignId, status: "ACTIVE" },
        select: { application: true },
      })
    ).map((t) => t.application as DnxPartnerApplication);

  if (!targets.length) throw new Error("Sin targets ACTIVE para publicar");

  await ensureOutboundForMarquee(input.campaignId, targets);
  const snapshot = await loadCampaignPublicationSnapshot(input.campaignId);
  if (!snapshot) throw new Error("Campaña no encontrada");

  await auditPublication({
    partnerId: snapshot.partner.id,
    campaignId: input.campaignId,
    action: "publication_requested",
    summary: `Publish → ${targets.join(",")}`,
    actorUserId: input.actorUserId,
    afterJson: { applications: targets },
  });

  const results = await publishPartnerCampaignToApplications({
    sourceDb: prisma,
    snapshot,
    applications: targets,
  });

  for (const r of results) {
    await auditPublication({
      partnerId: snapshot.partner.id,
      campaignId: input.campaignId,
      action: r.status === "SYNCED" ? "publication_success" : "publication_failed",
      summary: `${r.application}: ${r.status}${r.error ? ` (${r.error})` : ""}`,
      actorUserId: input.actorUserId,
      afterJson: r,
    });
  }
  return results;
}

export async function retryCampaignPublication(input: {
  campaignId: string;
  application: DnxPartnerApplication;
  actorUserId?: number | null;
}): Promise<PublishPartnerCampaignResult> {
  const snapshot = await loadCampaignPublicationSnapshot(input.campaignId);
  if (!snapshot) throw new Error("Campaña no encontrada");
  await auditPublication({
    partnerId: snapshot.partner.id,
    campaignId: input.campaignId,
    action: "publication_retry",
    summary: `Retry ${input.application}`,
    actorUserId: input.actorUserId,
  });
  return publishPartnerCampaignToApplication({
    sourceDb: prisma,
    snapshot,
    application: input.application,
  });
}

export async function listCampaignPublicationUi(campaignId: string) {
  const snapshot = await loadCampaignPublicationSnapshot(campaignId);
  const sourceVersion = snapshot
    ? computeCampaignPublicationContentHash(snapshot)
    : null;
  const targets = await prisma.dnxPartnerCampaignTarget.findMany({
    where: { campaignId },
  });
  const syncs = await prisma.dnxPartnerPublicationSync.findMany({
    where: { entityType: "CAMPAIGN", sourceEntityId: campaignId },
  });

  const apps: DnxPartnerApplication[] = ["INFO_SPOT", "COMPRAME_LA_FOTO"];
  return apps.map((application) => {
    const target = targets.find((t) => t.application === application);
    const sync = syncs.find((s) => s.targetApplication === application);
    const dbKey = resolvePublicationDatabaseKey(application);
    const info = dbKey ? getPartnersPublicationTargetInfo(dbKey) : null;
    return {
      application,
      selected: Boolean(target),
      targetStatus: target?.status ?? null,
      syncStatus: sync?.status ?? null,
      freshness: sync
        ? resolvePublicationFreshness({
            status: sync.status,
            sourceVersion: sourceVersion ?? sync.sourceVersion,
            targetVersion: sync.targetVersion,
          })
        : null,
      attempts: sync?.attempts ?? 0,
      lastError: sync?.lastError ?? null,
      lastSyncedAt: sync?.lastSyncedAt ?? null,
      dbConfigured: info?.configured ?? false,
      dbHostMasked: info?.hostMasked ?? null,
      adsFlagEnv:
        application === "INFO_SPOT"
          ? "INFOSPOT_PARTNER_ADS_ENABLED"
          : "CLF_PARTNER_ADS_ENABLED",
      adsFlagOn:
        application === "INFO_SPOT"
          ? process.env.INFOSPOT_PARTNER_ADS_ENABLED === "true" ||
            process.env.INFOSPOT_PARTNER_ADS_ENABLED === "1"
          : process.env.CLF_PARTNER_ADS_ENABLED === "true" ||
            process.env.CLF_PARTNER_ADS_ENABLED === "1",
    };
  });
}

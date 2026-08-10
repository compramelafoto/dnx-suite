/**
 * Publica snapshot de campaña Partners a DB destino (InfoSpot / CLF).
 * Idempotente: upsert por IDs canónicos. No replica PII privada.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  assertSnapshotReadyForPublish,
  computeCampaignPublicationContentHash,
  getAdPlacementCatalogEntry,
  resolvePublicationDatabaseKey,
  resolvePublicationFreshness,
  type DnxPartnerApplication,
  type PartnerCampaignPublicationSnapshot,
  type PartnerPublicationDatabaseKey,
  type PublishPartnerCampaignResult,
} from "@repo/partners";
import { ensureAdPlacementCatalog } from "./partners-ads-loader";
import { getPartnersPublicationClient } from "./partners-publication-targets";

function now() {
  return new Date();
}

async function upsertPublicPartner(
  db: PrismaClient,
  partner: PartnerCampaignPublicationSnapshot["partner"],
) {
  await db.dnxPartner.upsert({
    where: { id: partner.id },
    create: {
      id: partner.id,
      name: partner.name,
      legalName: partner.legalName,
      slug: partner.slug,
      description: partner.description,
      type: partner.type as never,
      status: partner.status as never,
      logoUrl: partner.logoUrl,
      websiteUrl: partner.websiteUrl,
      instagram: partner.instagram,
      facebookUrl: partner.facebookUrl,
      linkedinUrl: partner.linkedinUrl,
      city: partner.city,
      provinceOrState: partner.provinceOrState,
      country: partner.country,
      archivedAt: partner.archivedAt,
      updatedAt: now(),
      // intentionally omit email/phone/taxId/notes/address/financial
    },
    update: {
      name: partner.name,
      legalName: partner.legalName,
      slug: partner.slug,
      description: partner.description,
      type: partner.type as never,
      status: partner.status as never,
      logoUrl: partner.logoUrl,
      websiteUrl: partner.websiteUrl,
      instagram: partner.instagram,
      facebookUrl: partner.facebookUrl,
      linkedinUrl: partner.linkedinUrl,
      city: partner.city,
      provinceOrState: partner.provinceOrState,
      country: partner.country,
      archivedAt: partner.archivedAt,
      updatedAt: now(),
    },
  });
}

async function upsertAssets(
  db: PrismaClient,
  assets: PartnerCampaignPublicationSnapshot["assets"],
) {
  for (const a of assets) {
    await db.dnxPartnerAsset.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        partnerId: a.partnerId,
        type: a.type as never,
        name: a.name,
        description: a.description,
        storageProvider: a.storageProvider as never,
        storageKey: a.storageKey,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        fileExtension: a.fileExtension,
        fileSize: a.fileSize,
        width: a.width,
        height: a.height,
        aspectRatio: a.aspectRatio,
        backgroundType: a.backgroundType as never,
        isPrimary: a.isPrimary,
        status: a.status as never,
        approvalStatus: a.approvalStatus as never,
        altText: a.altText,
        archivedAt: a.archivedAt,
        updatedAt: now(),
      },
      update: {
        type: a.type as never,
        name: a.name,
        description: a.description,
        storageKey: a.storageKey,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        fileExtension: a.fileExtension,
        fileSize: a.fileSize,
        width: a.width,
        height: a.height,
        aspectRatio: a.aspectRatio,
        backgroundType: a.backgroundType as never,
        isPrimary: a.isPrimary,
        status: a.status as never,
        approvalStatus: a.approvalStatus as never,
        altText: a.altText,
        archivedAt: a.archivedAt,
        updatedAt: now(),
      },
    });
  }
}

async function upsertCampaignGraph(
  db: PrismaClient,
  snapshot: PartnerCampaignPublicationSnapshot,
  application: DnxPartnerApplication,
) {
  const c = snapshot.campaign;
  await db.dnxPartnerCampaign.upsert({
    where: { id: c.id },
    create: {
      id: c.id,
      partnerId: c.partnerId,
      name: c.name,
      description: c.description,
      application: application as never,
      status: c.status as never,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      priority: c.priority,
      destinationUrl: c.destinationUrl,
      trackingEnabled: c.trackingEnabled,
      geoScope: c.geoScope as never,
      archivedAt: c.archivedAt,
      updatedAt: now(),
    },
    update: {
      name: c.name,
      description: c.description,
      application: application as never,
      status: c.status as never,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      priority: c.priority,
      destinationUrl: c.destinationUrl,
      trackingEnabled: c.trackingEnabled,
      geoScope: c.geoScope as never,
      archivedAt: c.archivedAt,
      updatedAt: now(),
    },
  });

  await db.dnxPartnerCampaignGeoTarget.deleteMany({ where: { campaignId: c.id } });
  for (const g of snapshot.geoTargets) {
    await db.dnxPartnerCampaignGeoTarget.create({
      data: {
        id: g.id,
        campaignId: c.id,
        countryCode: g.countryCode,
        province: g.province,
        city: g.city,
        include: g.include,
      },
    });
  }

  await db.dnxPartnerCampaignContextTarget.deleteMany({ where: { campaignId: c.id } });
  for (const category of snapshot.contextTargets) {
    await db.dnxPartnerCampaignContextTarget.create({
      data: {
        id: `${c.id}_${category}`,
        campaignId: c.id,
        category: category as never,
      },
    });
  }

  for (const cr of snapshot.creatives) {
    await db.dnxPartnerCampaignCreative.upsert({
      where: { id: cr.id },
      create: {
        id: cr.id,
        campaignId: cr.campaignId,
        assetId: cr.assetId,
        format: cr.format as never,
        deviceTarget: cr.deviceTarget as never,
        title: cr.title,
        body: cr.body,
        ctaText: cr.ctaText,
        destinationUrl: cr.destinationUrl,
        status: cr.status as never,
        startsAt: cr.startsAt,
        endsAt: cr.endsAt,
        sortOrder: cr.sortOrder,
        archivedAt: cr.archivedAt,
        updatedAt: now(),
      },
      update: {
        assetId: cr.assetId,
        format: cr.format as never,
        deviceTarget: cr.deviceTarget as never,
        title: cr.title,
        body: cr.body,
        ctaText: cr.ctaText,
        destinationUrl: cr.destinationUrl,
        status: cr.status as never,
        startsAt: cr.startsAt,
        endsAt: cr.endsAt,
        sortOrder: cr.sortOrder,
        archivedAt: cr.archivedAt,
        updatedAt: now(),
      },
    });
  }

  await ensureAdPlacementCatalog(db);
  const bindingsForApp = snapshot.placementBindings.filter((b) =>
    Boolean(getAdPlacementCatalogEntry(application, b.placementKey)),
  );
  if (bindingsForApp.length === 0) {
    throw new Error(`Sin placements compatibles para ${application}`);
  }
  for (const b of bindingsForApp) {
    const placement = await db.dnxPartnerAdPlacement.findUnique({
      where: {
        application_placementKey: {
          application: application as never,
          placementKey: b.placementKey,
        },
      },
    });
    if (!placement) continue;
    await db.dnxPartnerCampaignPlacement.upsert({
      where: {
        campaignId_adPlacementId: {
          campaignId: c.id,
          adPlacementId: placement.id,
        },
      },
      create: {
        id: b.id,
        campaignId: c.id,
        adPlacementId: placement.id,
        priority: b.priority,
        isActive: b.isActive,
        updatedAt: now(),
      },
      update: {
        priority: b.priority,
        isActive: b.isActive,
        updatedAt: now(),
      },
    });
  }

  const outboundForApp = snapshot.outboundLinks.filter(
    (o) => o.application === application,
  );
  for (const o of outboundForApp) {
    await db.dnxPartnerOutboundLink.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        trackingKey: o.trackingKey,
        partnerId: c.partnerId,
        application: application as never,
        placement: o.placement as never,
        destinationUrl: o.destinationUrl,
        utmSource: o.utmSource,
        utmMedium: o.utmMedium,
        utmCampaign: o.utmCampaign,
        utmContent: o.utmContent,
        status: o.status as never,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        archivedAt: o.archivedAt,
        updatedAt: now(),
      },
      update: {
        trackingKey: o.trackingKey,
        placement: o.placement as never,
        destinationUrl: o.destinationUrl,
        utmSource: o.utmSource,
        utmMedium: o.utmMedium,
        utmCampaign: o.utmCampaign,
        utmContent: o.utmContent,
        status: o.status as never,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        archivedAt: o.archivedAt,
        application: application as never,
        updatedAt: now(),
      },
    });
  }
}

/**
 * Publica una campaña a una aplicación destino.
 * No hace rollback de otras apps si falla.
 */
export async function publishPartnerCampaignToApplication(input: {
  sourceDb: PrismaClient;
  snapshot: PartnerCampaignPublicationSnapshot;
  application: DnxPartnerApplication;
  /** Si true, no escribe remoto — solo valida/config. */
  dryRun?: boolean;
}): Promise<PublishPartnerCampaignResult> {
  const databaseKey = resolvePublicationDatabaseKey(input.application);
  if (!databaseKey) {
    return {
      application: input.application,
      databaseKey: "INFOSPOT",
      status: "FAILED",
      freshness: "FAILED",
      sourceVersion: "",
      attempts: 0,
      error: `Aplicación ${input.application} no tiene DB destino configurada`,
    };
  }

  assertSnapshotReadyForPublish(input.snapshot);
  const sourceVersion = computeCampaignPublicationContentHash(input.snapshot);

  const syncWhere = {
    entityType_sourceEntityId_targetApplication: {
      entityType: "CAMPAIGN" as const,
      sourceEntityId: input.snapshot.campaign.id,
      targetApplication: input.application as never,
    },
  };

  const existing = await input.sourceDb.dnxPartnerPublicationSync.findUnique({
    where: syncWhere,
  });
  const attempts = (existing?.attempts ?? 0) + 1;

  await input.sourceDb.dnxPartnerPublicationSync.upsert({
    where: syncWhere,
    create: {
      id: randomUUID(),
      entityType: "CAMPAIGN",
      sourceEntityId: input.snapshot.campaign.id,
      campaignId: input.snapshot.campaign.id,
      targetApplication: input.application as never,
      targetDatabaseKey: databaseKey,
      sourceVersion,
      status: "SYNCING",
      attempts,
      updatedAt: now(),
    },
    update: {
      campaignId: input.snapshot.campaign.id,
      targetDatabaseKey: databaseKey,
      sourceVersion,
      status: "SYNCING",
      attempts,
      lastError: null,
      updatedAt: now(),
    },
  });

  if (input.dryRun) {
    await input.sourceDb.dnxPartnerPublicationSync.update({
      where: syncWhere,
      data: {
        status: "SYNCED",
        targetVersion: sourceVersion,
        lastSyncedAt: now(),
        updatedAt: now(),
      },
    });
    return {
      application: input.application,
      databaseKey,
      status: "SYNCED",
      freshness: "UP_TO_DATE",
      sourceVersion,
      attempts,
    };
  }

  try {
    const remote = getPartnersPublicationClient(databaseKey);
    await upsertPublicPartner(remote, input.snapshot.partner);
    await upsertAssets(remote, input.snapshot.assets);
    await upsertCampaignGraph(remote, input.snapshot, input.application);

    await input.sourceDb.dnxPartnerPublicationSync.update({
      where: syncWhere,
      data: {
        status: "SYNCED",
        targetVersion: sourceVersion,
        lastSyncedAt: now(),
        lastError: null,
        updatedAt: now(),
      },
    });

    return {
      application: input.application,
      databaseKey,
      status: "SYNCED",
      freshness: "UP_TO_DATE",
      sourceVersion,
      attempts,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "publish_failed";
    await input.sourceDb.dnxPartnerPublicationSync.update({
      where: syncWhere,
      data: {
        status: "FAILED",
        lastError: message.slice(0, 500),
        updatedAt: now(),
      },
    });
    return {
      application: input.application,
      databaseKey,
      status: "FAILED",
      freshness: "FAILED",
      sourceVersion,
      attempts,
      error: message,
    };
  }
}

export async function publishPartnerCampaignToApplications(input: {
  sourceDb: PrismaClient;
  snapshot: PartnerCampaignPublicationSnapshot;
  applications: readonly DnxPartnerApplication[];
  dryRun?: boolean;
}): Promise<PublishPartnerCampaignResult[]> {
  const results: PublishPartnerCampaignResult[] = [];
  for (const application of input.applications) {
    results.push(
      await publishPartnerCampaignToApplication({
        sourceDb: input.sourceDb,
        snapshot: input.snapshot,
        application,
        dryRun: input.dryRun,
      }),
    );
  }
  return results;
}

export function freshnessFromSyncRow(row: {
  status: string;
  sourceVersion: string;
  targetVersion: string | null;
}): ReturnType<typeof resolvePublicationFreshness> {
  return resolvePublicationFreshness({
    status: row.status as never,
    sourceVersion: row.sourceVersion,
    targetVersion: row.targetVersion,
  });
}

export type { PartnerPublicationDatabaseKey };

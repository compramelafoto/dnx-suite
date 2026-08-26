/**
 * Publicación multi-app de campañas Partners.
 * Snapshot público + versionado + estados de sync (sin secretos / sin PII privada).
 */

import { createHash } from "node:crypto";
import type { DnxPartnerApplication } from "./types";
import type {
  DnxPartnerCampaignContextCategory,
  DnxPartnerCampaignGeoScope,
  DnxPartnerCampaignStatus,
  DnxPartnerCreativeDeviceTarget,
  DnxPartnerCreativeFormat,
  DnxPartnerCreativeStatus,
  DnxPartnerAdRotationMode,
} from "./campaigns";
import type { DnxPartnerPlacement } from "./tracking";

export const DNX_PARTNER_PUBLICATION_SYNC_STATUSES = [
  "PENDING",
  "SYNCING",
  "SYNCED",
  "FAILED",
] as const;
export type DnxPartnerPublicationSyncStatus =
  (typeof DNX_PARTNER_PUBLICATION_SYNC_STATUSES)[number];

export const DNX_PARTNER_CAMPAIGN_TARGET_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type DnxPartnerCampaignTargetStatus =
  (typeof DNX_PARTNER_CAMPAIGN_TARGET_STATUSES)[number];

export const PARTNER_PUBLICATION_DATABASE_KEYS = ["INFOSPOT", "CLF"] as const;
export type PartnerPublicationDatabaseKey =
  (typeof PARTNER_PUBLICATION_DATABASE_KEYS)[number];

export const PUBLICATION_APP_TO_DB_KEY: Partial<
  Record<DnxPartnerApplication, PartnerPublicationDatabaseKey>
> = {
  INFO_SPOT: "INFOSPOT",
  COMPRAME_LA_FOTO: "CLF",
};

export const PUBLICATION_ENV_BY_DB_KEY: Record<PartnerPublicationDatabaseKey, string> = {
  INFOSPOT: "DNX_PARTNERS_INFOSPOT_DATABASE_URL",
  CLF: "DNX_PARTNERS_CLF_DATABASE_URL",
};

/** Campos de Partner que NUNCA se publican a DBs destino. */
export const PARTNER_PUBLICATION_EXCLUDED_FIELDS = [
  "notes",
  "email",
  "phone",
  "taxId",
  "address",
  "postalCode",
  "financialIdentityId",
  "contacts",
  "onboardingInvitations",
  "auditEvents",
  "grants",
  "benefits",
] as const;

export type PartnerPublicationPublicPartner = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  description: string | null;
  type: string;
  status: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string | null;
  archivedAt: Date | null;
};

export type PartnerPublicationAsset = {
  id: string;
  partnerId: string;
  type: string;
  name: string;
  description: string | null;
  storageProvider: string;
  storageKey: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  backgroundType: string;
  isPrimary: boolean;
  status: string;
  approvalStatus: string;
  altText: string | null;
  archivedAt: Date | null;
};

export type PartnerPublicationCreative = {
  id: string;
  campaignId: string;
  assetId: string;
  format: DnxPartnerCreativeFormat;
  deviceTarget: DnxPartnerCreativeDeviceTarget;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  destinationUrl: string | null;
  status: DnxPartnerCreativeStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
  archivedAt: Date | null;
};

export type PartnerPublicationGeoTarget = {
  id: string;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  include: boolean;
};

export type PartnerPublicationPlacementBinding = {
  id: string;
  placementKey: string;
  priority: number;
  isActive: boolean;
  trackingPlacement: DnxPartnerPlacement;
  rotationMode: DnxPartnerAdRotationMode;
  maxItems: number;
};

export type PartnerPublicationOutbound = {
  id: string;
  trackingKey: string;
  application: DnxPartnerApplication;
  placement: DnxPartnerPlacement;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  archivedAt: Date | null;
};

export type PartnerCampaignPublicationSnapshot = {
  partner: PartnerPublicationPublicPartner;
  campaign: {
    id: string;
    partnerId: string;
    name: string;
    description: string | null;
    status: DnxPartnerCampaignStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    priority: number;
    destinationUrl: string | null;
    trackingEnabled: boolean;
    geoScope: DnxPartnerCampaignGeoScope;
    archivedAt: Date | null;
  };
  creatives: PartnerPublicationCreative[];
  assets: PartnerPublicationAsset[];
  geoTargets: PartnerPublicationGeoTarget[];
  contextTargets: DnxPartnerCampaignContextCategory[];
  placementBindings: PartnerPublicationPlacementBinding[];
  outboundLinks: PartnerPublicationOutbound[];
};

export type PublicationFreshness = "UP_TO_DATE" | "OUTDATED" | "FAILED" | "PENDING" | "SYNCING";

export function resolvePublicationDatabaseKey(
  application: DnxPartnerApplication,
): PartnerPublicationDatabaseKey | null {
  return PUBLICATION_APP_TO_DB_KEY[application] ?? null;
}

export function computeCampaignPublicationContentHash(
  snapshot: PartnerCampaignPublicationSnapshot,
): string {
  const payload = {
    partner: {
      id: snapshot.partner.id,
      name: snapshot.partner.name,
      slug: snapshot.partner.slug,
      logoUrl: snapshot.partner.logoUrl,
      websiteUrl: snapshot.partner.websiteUrl,
      status: snapshot.partner.status,
      archivedAt: snapshot.partner.archivedAt?.toISOString() ?? null,
    },
    campaign: {
      id: snapshot.campaign.id,
      name: snapshot.campaign.name,
      description: snapshot.campaign.description,
      status: snapshot.campaign.status,
      startsAt: snapshot.campaign.startsAt?.toISOString() ?? null,
      endsAt: snapshot.campaign.endsAt?.toISOString() ?? null,
      priority: snapshot.campaign.priority,
      destinationUrl: snapshot.campaign.destinationUrl,
      trackingEnabled: snapshot.campaign.trackingEnabled,
      geoScope: snapshot.campaign.geoScope,
      archivedAt: snapshot.campaign.archivedAt?.toISOString() ?? null,
    },
    creatives: snapshot.creatives
      .map((c) => ({
        id: c.id,
        assetId: c.assetId,
        format: c.format,
        deviceTarget: c.deviceTarget,
        title: c.title,
        body: c.body,
        ctaText: c.ctaText,
        destinationUrl: c.destinationUrl,
        status: c.status,
        sortOrder: c.sortOrder,
        archivedAt: c.archivedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    assets: snapshot.assets
      .map((a) => ({
        id: a.id,
        type: a.type,
        fileUrl: a.fileUrl,
        storageKey: a.storageKey,
        approvalStatus: a.approvalStatus,
        status: a.status,
        isPrimary: a.isPrimary,
        archivedAt: a.archivedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    geoTargets: snapshot.geoTargets
      .map((g) => ({
        id: g.id,
        countryCode: g.countryCode,
        province: g.province,
        city: g.city,
        include: g.include,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    contextTargets: [...snapshot.contextTargets].sort(),
    placementBindings: snapshot.placementBindings
      .map((p) => ({
        id: p.id,
        placementKey: p.placementKey,
        priority: p.priority,
        isActive: p.isActive,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    outboundLinks: snapshot.outboundLinks
      .map((o) => ({
        id: o.id,
        trackingKey: o.trackingKey,
        application: o.application,
        placement: o.placement,
        destinationUrl: o.destinationUrl,
        status: o.status,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
}

export function resolvePublicationFreshness(input: {
  status: DnxPartnerPublicationSyncStatus;
  sourceVersion: string;
  targetVersion?: string | null;
}): PublicationFreshness {
  if (input.status === "FAILED") return "FAILED";
  if (input.status === "PENDING") return "PENDING";
  if (input.status === "SYNCING") return "SYNCING";
  if (input.status === "SYNCED") {
    if (input.targetVersion && input.targetVersion === input.sourceVersion) {
      return "UP_TO_DATE";
    }
    return "OUTDATED";
  }
  return "PENDING";
}

export type PublishPartnerCampaignResult = {
  application: DnxPartnerApplication;
  databaseKey: PartnerPublicationDatabaseKey;
  status: DnxPartnerPublicationSyncStatus;
  freshness: PublicationFreshness;
  sourceVersion: string;
  attempts: number;
  error?: string;
};

export function assertSnapshotReadyForPublish(snapshot: PartnerCampaignPublicationSnapshot): void {
  if (snapshot.campaign.archivedAt) {
    throw new Error("Campaña archivada: no se publica");
  }
  if (snapshot.partner.archivedAt || snapshot.partner.status === "ARCHIVED") {
    throw new Error("Partner archivado: no se publica");
  }
  if (!snapshot.creatives.some((c) => c.status === "APPROVED" && !c.archivedAt)) {
    throw new Error("Se requiere al menos un creative APPROVED");
  }
  if (!snapshot.assets.some((a) => a.approvalStatus === "APPROVED" && a.fileUrl && !a.archivedAt)) {
    throw new Error("Se requiere asset aprobado con fileUrl");
  }
  if (!snapshot.placementBindings.some((p) => p.isActive)) {
    throw new Error("Se requiere al menos un placement activo");
  }
  const dest =
    snapshot.campaign.destinationUrl?.trim() ||
    snapshot.creatives.find((c) => c.destinationUrl)?.destinationUrl?.trim() ||
    snapshot.partner.websiteUrl?.trim();
  if (!dest || !/^https?:\/\//i.test(dest)) {
    throw new Error("destinationUrl inválido (http/https requerido)");
  }
}

/**
 * Ingest de impresiones Partners (server). Soft-fail; sin PII.
 * Impresión viewable independiente del outbound/clic.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  classifyDeviceClass,
  ephemeralClientKey,
  getAdPlacementCatalogEntry,
  isLikelyBotUserAgent,
  isPartnerImpressionTrackingEnabled,
  shouldSkipClickForRateLimit,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerApplication,
  type ImpressionIngestInput,
} from "@repo/partners";

export type ImpressionIngestResult =
  | { ok: true; tracked: boolean; reason?: string }
  | { ok: false; reason: string };

function isWithinWindow(
  now: Date,
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
): boolean {
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
}

async function persistImpression(
  prisma: PrismaClient,
  args: {
    partnerId: string;
    campaignId: string;
    creativeId: string;
    outboundLinkId: string | null;
    application: DnxPartnerApplication;
    trackingPlacement: string;
    placementKey: string;
    userAgent?: string | null;
    viewSessionKey?: string | null;
  },
): Promise<ImpressionIngestResult> {
  if (isLikelyBotUserAgent(args.userAgent)) {
    return { ok: true, tracked: false, reason: "bot" };
  }

  const deviceClass = classifyDeviceClass(args.userAgent);
  const meta =
    args.viewSessionKey?.trim()
      ? { viewSessionKey: args.viewSessionKey.trim().slice(0, 64) }
      : undefined;

  await prisma.dnxPartnerImpressionEvent.create({
    data: {
      id: randomUUID(),
      partnerId: args.partnerId,
      campaignId: args.campaignId,
      creativeId: args.creativeId,
      outboundLinkId: args.outboundLinkId,
      application: args.application as never,
      placement: args.trackingPlacement as never,
      adPlacementKey: args.placementKey,
      deviceClass: deviceClass as never,
      sourceType: "CAMPAIGN",
      isBot: false,
      metadata: meta as never,
    },
  });

  return { ok: true, tracked: true };
}

/** Camino histórico: requiere outbound `/r/[trackingKey]`. */
async function ingestWithOutbound(
  prisma: PrismaClient,
  input: ImpressionIngestInput,
  trackingKey: string,
  creativeId: string,
  placementKey: string,
  catalog: NonNullable<ReturnType<typeof getAdPlacementCatalogEntry>>,
): Promise<ImpressionIngestResult> {
  const bot = isLikelyBotUserAgent(input.userAgent);
  const rateKey = ephemeralClientKey(
    `imp:${trackingKey}:${creativeId}:${input.clientSeed ?? "anon"}`,
  );
  if (!bot && shouldSkipClickForRateLimit(rateKey, 30, 60_000)) {
    return { ok: true, tracked: false, reason: "rate_limited" };
  }

  const link = await prisma.dnxPartnerOutboundLink.findUnique({
    where: { trackingKey },
    select: {
      id: true,
      partnerId: true,
      application: true,
      placement: true,
      status: true,
      archivedAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!link || link.archivedAt || link.status !== "ACTIVE") {
    return { ok: false, reason: "link_not_found" };
  }
  if (link.application !== input.application) {
    return { ok: false, reason: "wrong_application" };
  }

  const creative = await prisma.dnxPartnerCampaignCreative.findFirst({
    where: {
      id: creativeId,
      archivedAt: null,
      status: "APPROVED",
      campaign: {
        partnerId: link.partnerId,
        application: input.application,
        status: "ACTIVE",
        archivedAt: null,
      },
    },
    select: {
      id: true,
      campaignId: true,
      campaign: {
        select: {
          id: true,
          status: true,
          publishTargets: {
            where: { application: input.application },
            select: { status: true },
          },
        },
      },
    },
  });
  if (!creative) {
    return { ok: false, reason: "creative_invalid" };
  }

  const target = creative.campaign.publishTargets[0];
  if (target && target.status !== "ACTIVE") {
    return { ok: false, reason: "target_paused" };
  }

  return persistImpression(prisma, {
    partnerId: link.partnerId,
    campaignId: creative.campaignId,
    creativeId: creative.id,
    outboundLinkId: link.id,
    application: input.application,
    trackingPlacement: catalog.trackingPlacement,
    placementKey,
    userAgent: input.userAgent,
    viewSessionKey: input.viewSessionKey,
  });
}

/**
 * Camino sin outbound: impresión por campaign + creative + placement.
 * Validación estricta (binding, formato, vigencia, trackingEnabled).
 */
async function ingestWithoutOutbound(
  prisma: PrismaClient,
  input: ImpressionIngestInput,
  campaignId: string,
  creativeId: string,
  placementKey: string,
  catalog: NonNullable<ReturnType<typeof getAdPlacementCatalogEntry>>,
): Promise<ImpressionIngestResult> {
  const bot = isLikelyBotUserAgent(input.userAgent);
  const rateKey = ephemeralClientKey(
    `imp:${campaignId}:${creativeId}:${input.clientSeed ?? "anon"}`,
  );
  if (!bot && shouldSkipClickForRateLimit(rateKey, 30, 60_000)) {
    return { ok: true, tracked: false, reason: "rate_limited" };
  }

  const now = new Date();
  const creative = await prisma.dnxPartnerCampaignCreative.findFirst({
    where: {
      id: creativeId,
      campaignId,
      archivedAt: null,
      status: "APPROVED",
      format: { in: [...catalog.allowedFormats] },
      campaign: {
        id: campaignId,
        application: input.application,
        status: "ACTIVE",
        archivedAt: null,
        trackingEnabled: true,
        placementBindings: {
          some: {
            isActive: true,
            adPlacement: {
              application: input.application,
              placementKey,
              isActive: true,
            },
          },
        },
      },
    },
    select: {
      id: true,
      campaignId: true,
      startsAt: true,
      endsAt: true,
      campaign: {
        select: {
          id: true,
          partnerId: true,
          startsAt: true,
          endsAt: true,
          publishTargets: {
            where: { application: input.application },
            select: { status: true },
          },
        },
      },
    },
  });
  if (!creative) {
    return { ok: false, reason: "creative_invalid" };
  }

  if (
    !isWithinWindow(now, creative.startsAt, creative.endsAt) ||
    !isWithinWindow(now, creative.campaign.startsAt, creative.campaign.endsAt)
  ) {
    return { ok: false, reason: "out_of_schedule" };
  }

  const target = creative.campaign.publishTargets[0];
  if (target && target.status !== "ACTIVE") {
    return { ok: false, reason: "target_paused" };
  }

  return persistImpression(prisma, {
    partnerId: creative.campaign.partnerId,
    campaignId: creative.campaignId,
    creativeId: creative.id,
    outboundLinkId: null,
    application: input.application,
    trackingPlacement: catalog.trackingPlacement,
    placementKey,
    userAgent: input.userAgent,
    viewSessionKey: input.viewSessionKey,
  });
}

export async function ingestPartnerImpression(
  prisma: PrismaClient,
  input: ImpressionIngestInput,
): Promise<ImpressionIngestResult> {
  try {
    if (!isPartnerImpressionTrackingEnabled()) {
      return { ok: true, tracked: false, reason: "disabled" };
    }

    if (input.application === "FOTO_OFFICE") {
      return { ok: false, reason: "foto_office_excluded" };
    }

    const trackingKey = input.trackingKey?.trim() || "";
    const creativeId = input.creativeId?.trim() || "";
    const placementKey = input.placementKey?.trim() || "";
    const campaignId = input.campaignId?.trim() || "";

    if (!creativeId || !placementKey) {
      return { ok: false, reason: "invalid_payload" };
    }

    const catalog = getAdPlacementCatalogEntry(
      input.application,
      placementKey as DnxPartnerAdPlacementKey,
    );
    if (!catalog) {
      return { ok: false, reason: "invalid_placement" };
    }

    if (trackingKey) {
      return ingestWithOutbound(
        prisma,
        input,
        trackingKey,
        creativeId,
        placementKey,
        catalog,
      );
    }

    if (!campaignId) {
      return { ok: false, reason: "invalid_payload" };
    }

    return ingestWithoutOutbound(
      prisma,
      input,
      campaignId,
      creativeId,
      placementKey,
      catalog,
    );
  } catch {
    return { ok: true, tracked: false, reason: "soft_fail" };
  }
}

export type { DnxPartnerApplication };

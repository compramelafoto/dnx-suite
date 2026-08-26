/**
 * Ingest de impresiones Partners (server). Soft-fail; sin PII.
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

export async function ingestPartnerImpression(
  prisma: PrismaClient,
  input: ImpressionIngestInput,
): Promise<ImpressionIngestResult> {
  try {
    if (!isPartnerImpressionTrackingEnabled()) {
      return { ok: true, tracked: false, reason: "disabled" };
    }

    const trackingKey = input.trackingKey?.trim();
    const creativeId = input.creativeId?.trim();
    const placementKey = input.placementKey?.trim();
    if (!trackingKey || !creativeId || !placementKey) {
      return { ok: false, reason: "invalid_payload" };
    }

    const catalog = getAdPlacementCatalogEntry(
      input.application,
      placementKey as DnxPartnerAdPlacementKey,
    );
    if (!catalog) {
      return { ok: false, reason: "invalid_placement" };
    }

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
    // Si hay target tipado, debe estar ACTIVE; si no hay fila (legacy), se permite.
    if (target && target.status !== "ACTIVE") {
      return { ok: false, reason: "target_paused" };
    }

    if (bot) {
      // No persistir bots (alineado a clicks).
      return { ok: true, tracked: false, reason: "bot" };
    }

    const deviceClass = classifyDeviceClass(input.userAgent);
    const meta =
      input.viewSessionKey?.trim()
        ? { viewSessionKey: input.viewSessionKey.trim().slice(0, 64) }
        : undefined;

    await prisma.dnxPartnerImpressionEvent.create({
      data: {
        id: randomUUID(),
        partnerId: link.partnerId,
        campaignId: creative.campaignId,
        creativeId: creative.id,
        outboundLinkId: link.id,
        application: input.application as never,
        placement: catalog.trackingPlacement as never,
        adPlacementKey: placementKey,
        deviceClass: deviceClass as never,
        sourceType: "CAMPAIGN",
        isBot: false,
        metadata: meta as never,
      },
    });

    return { ok: true, tracked: true };
  } catch {
    return { ok: true, tracked: false, reason: "soft_fail" };
  }
}

export type { DnxPartnerApplication };

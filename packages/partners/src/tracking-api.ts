import type { PartnersRepository } from "./repository";
import type { DnxPartnerApplication, PartnerActor, ParticipationRecord } from "./types";
import { PartnersDomainError } from "./types";
import { assertPartnerCapability } from "./permissions";
import {
  aggregateClickEvents,
  assertSafePartnerDestinationUrl,
  buildPartnerAttributedUrl,
  buildTrackingKey,
  classifyBrowserFamily,
  classifyDeviceClass,
  defaultUtmSource,
  emptyTrafficSummary,
  ephemeralClientKey,
  isLikelyBotUserAgent,
  isOutboundLinkCurrentlyValid,
  isPartnerClickTrackingEnabled,
  partnerRedirectPath,
  resolveParticipationDestinationUrl,
  sanitizeReferrerHost,
  shouldSkipClickForRateLimit,
  type ClickEventRecord,
  type DnxPartnerPlacement,
  type OutboundLinkRecord,
  type PartnerTrafficSummary,
} from "./tracking";

type AuditFn = (
  actor: PartnerActor,
  params: {
    partnerId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    summary?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) => Promise<void>;

export type EnsureParticipationOutboundLinkInput = {
  participation: ParticipationRecord;
  partnerSlug: string;
  partnerWebsiteUrl?: string | null;
  placement?: DnxPartnerPlacement;
  utmCampaign?: string | null;
  utmContent?: string | null;
  assetId?: string | null;
};

export type ResolveOutboundRedirectInput = {
  trackingKey: string;
  userAgent?: string | null;
  referrer?: string | null;
  clientSeed?: string | null;
};

export type ResolveOutboundRedirectResult = {
  ok: true;
  redirectUrl: string;
  tracked: boolean;
  link: OutboundLinkRecord;
} | {
  ok: false;
  reason: "NOT_FOUND" | "INACTIVE" | "INVALID_DESTINATION";
};

export function createPartnerTrackingApi(repo: PartnersRepository, audit: AuditFn) {
  return {
    async ensureParticipationOutboundLink(
      actor: PartnerActor,
      input: EnsureParticipationOutboundLinkInput,
    ): Promise<OutboundLinkRecord | null> {
      assertPartnerCapability(actor, "PARTNER_PARTICIPATIONS_MANAGE");
      const destination = resolveParticipationDestinationUrl({
        participationDestinationUrl: input.participation.destinationUrl,
        partnerWebsiteUrl: input.partnerWebsiteUrl,
      });
      if (!destination) return null;
      if (input.participation.clickTrackingEnabled === false) return null;

      const placement = input.placement ?? "LOGO";
      const existing = await repo.findOutboundLinkByParticipationPlacement(
        input.participation.id,
        placement,
      );

      const utmSource = defaultUtmSource(input.participation.application);
      const utmMedium = "partner";
      const utmCampaign = input.utmCampaign?.trim() || null;
      const utmContent = input.utmContent?.trim() || placement.toLowerCase();

      if (existing && !existing.archivedAt) {
        const updated = await repo.updateOutboundLink(existing.id, {
          destinationUrl: destination,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          status: "ACTIVE",
          application: input.participation.application,
          contextType: input.participation.contextType,
          contextId: input.participation.contextId,
          assetId: input.assetId ?? existing.assetId,
        });
        await audit(actor, {
          partnerId: input.participation.partnerId,
          entityType: "DnxPartnerOutboundLink",
          entityId: updated.id,
          action: "OUTBOUND_LINK_UPDATED",
          summary: "Destino / UTM de outbound link actualizado",
          before: { destinationUrl: existing.destinationUrl },
          after: { destinationUrl: updated.destinationUrl },
        });
        return updated;
      }

      let trackingKey = buildTrackingKey(input.partnerSlug);
      for (let i = 0; i < 5; i++) {
        const clash = await repo.getOutboundLinkByTrackingKey(trackingKey);
        if (!clash) break;
        trackingKey = buildTrackingKey(input.partnerSlug);
      }

      const created = await repo.createOutboundLink({
        trackingKey,
        partnerId: input.participation.partnerId,
        participationId: input.participation.id,
        application: input.participation.application,
        contextType: input.participation.contextType,
        contextId: input.participation.contextId,
        assetId: input.assetId ?? null,
        placement,
        destinationUrl: destination,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        status: "ACTIVE",
      });
      await audit(actor, {
        partnerId: input.participation.partnerId,
        entityType: "DnxPartnerOutboundLink",
        entityId: created.id,
        action: "OUTBOUND_LINK_CREATED",
        summary: "Outbound link trackeable creado",
        after: { trackingKey: created.trackingKey, destinationUrl: created.destinationUrl },
      });
      return created;
    },

    async getPublicTrackedHrefForParticipation(
      participation: ParticipationRecord,
      opts?: { partnerWebsiteUrl?: string | null; partnerSlug?: string },
    ): Promise<string | null> {
      const destination = resolveParticipationDestinationUrl({
        participationDestinationUrl: participation.destinationUrl,
        partnerWebsiteUrl: opts?.partnerWebsiteUrl,
      });
      if (!destination) return null;

      if (
        !isPartnerClickTrackingEnabled() ||
        participation.clickTrackingEnabled === false
      ) {
        return destination;
      }

      const existing = await repo.findOutboundLinkByParticipationPlacement(
        participation.id,
        "LOGO",
      );
      if (existing && isOutboundLinkCurrentlyValid(existing)) {
        return partnerRedirectPath(existing.trackingKey);
      }
      return destination;
    },

    async resolveOutboundRedirect(
      input: ResolveOutboundRedirectInput,
    ): Promise<ResolveOutboundRedirectResult> {
      const link = await repo.getOutboundLinkByTrackingKey(input.trackingKey);
      if (!link || link.archivedAt) {
        return { ok: false, reason: "NOT_FOUND" };
      }
      if (!isOutboundLinkCurrentlyValid(link)) {
        return { ok: false, reason: "INACTIVE" };
      }

      let destination: string;
      try {
        destination = assertSafePartnerDestinationUrl(link.destinationUrl);
      } catch {
        return { ok: false, reason: "INVALID_DESTINATION" };
      }

      const redirectUrl = buildPartnerAttributedUrl({
        destinationUrl: destination,
        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign,
        utmContent: link.utmContent,
      });

      let tracked = false;
      if (isPartnerClickTrackingEnabled()) {
        const bot = isLikelyBotUserAgent(input.userAgent);
        const rateKey = ephemeralClientKey(
          `${link.trackingKey}:${input.clientSeed ?? "anon"}`,
        );
        const rateLimited = shouldSkipClickForRateLimit(rateKey);
        if (!bot && !rateLimited) {
          try {
            await repo.createClickEvent({
              outboundLinkId: link.id,
              partnerId: link.partnerId,
              participationId: link.participationId,
              application: link.application,
              contextType: link.contextType as ParticipationRecord["contextType"],
              contextId: link.contextId,
              assetId: link.assetId,
              placement: link.placement,
              referrerHost: sanitizeReferrerHost(input.referrer),
              deviceClass: classifyDeviceClass(input.userAgent),
              browserFamily: classifyBrowserFamily(input.userAgent),
              countryCode: null,
              metadata: null,
            });
            tracked = true;
          } catch (err) {
            console.error("[partners.tracking] click persist failed", {
              trackingKey: link.trackingKey,
              partnerId: link.partnerId,
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        }
      }

      return { ok: true, redirectUrl, tracked, link };
    },

    async getPartnerTrafficSummary(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<PartnerTrafficSummary> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      const partner = await repo.getPartnerById(partnerId);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      const events = await repo.listClickEventsByPartner(partnerId);
      return aggregateClickEvents(events);
    },

    async countParticipationClicks(
      actor: PartnerActor,
      participationId: string,
    ): Promise<number> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.countClickEvents({ participationId });
    },

    /** Alias canónico del prompt de métricas (mismo que countClickEvents por partner). */
    async countPartnerClicks(actor: PartnerActor, partnerId: string): Promise<number> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.countClickEvents({ partnerId });
    },

    async countClicksByApplication(
      actor: PartnerActor,
      partnerId: string,
      application: DnxPartnerApplication,
    ): Promise<number> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.countClickEvents({ partnerId, application });
    },

    async countClicksByContext(
      actor: PartnerActor,
      partnerId: string,
      contextId: string,
    ): Promise<number> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.countClickEvents({ partnerId, contextId });
    },

    async countClicksByPlacement(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<Record<string, number>> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      const events = await repo.listClickEventsByPartner(partnerId);
      return aggregateClickEvents(events).byPlacement;
    },

    async listPartnerOutboundLinks(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<OutboundLinkRecord[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listOutboundLinksByPartner(partnerId);
    },
  };
}

export type PartnerTrackingApi = ReturnType<typeof createPartnerTrackingApi>;

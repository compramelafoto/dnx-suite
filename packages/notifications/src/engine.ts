/**
 * NotificationEngine — orquestación pura (sin I/O).
 */

import { selectPhotographerAudience, parseAudienceScope } from "./audience";
import {
  createNotificationEvent,
  shouldEmitPhotographerCallOpened,
} from "./events";
import {
  confirmationSummary,
  evaluateCampaignPolicy,
  withAntiSpamOnPreview,
  type CampaignPolicyContext,
  type PolicyDecision,
} from "./policies";
import {
  renderNearbyPhotographerCallTemplate,
  appendAttributionParams,
  type TemplateVariables,
} from "./templates";
import { buildDeliveryDedupeKey, buildCampaignDedupeKey } from "./deduplication";
import { planSchedule } from "./scheduling";
import { explainAudienceSelection } from "./explain";
import { emptyDeliveryMetrics, resolveNextDeliveryStatus } from "./delivery";
import type {
  AudiencePreview,
  CallAudienceContext,
  NotificationCandidate,
  NotificationDeliveryPlan,
  NotificationEvent,
  PhotographerAudienceInput,
} from "./contracts";
import type { AudienceScopeMode } from "./config";

export type BuildAudienceInput = {
  photographers: PhotographerAudienceInput[];
  context: CallAudienceContext;
  recentSimilarByUserId?: Map<number | string, number>;
};

export type CampaignDraft = {
  event: NotificationEvent;
  campaignDedupeKey: string;
  preview: AudiencePreview;
  explanation: ReturnType<typeof explainAudienceSelection>;
  confirmationText: string;
  policy: PolicyDecision;
  deliveries: NotificationDeliveryPlan[];
  metrics: ReturnType<typeof emptyDeliveryMetrics>;
  schedule: ReturnType<typeof planSchedule>;
};

export class NotificationEngine {
  createEvent(
    ...args: Parameters<typeof createNotificationEvent>
  ): NotificationEvent {
    return createNotificationEvent(...args);
  }

  shouldEmitCallOpened(
    ...args: Parameters<typeof shouldEmitPhotographerCallOpened>
  ): boolean {
    return shouldEmitPhotographerCallOpened(...args);
  }

  parseScope(
    ...args: Parameters<typeof parseAudienceScope>
  ): AudienceScopeMode {
    return parseAudienceScope(...args);
  }

  selectAudience(input: BuildAudienceInput): AudiencePreview {
    let preview = selectPhotographerAudience(input.photographers, input.context);
    if (input.recentSimilarByUserId) {
      preview = withAntiSpamOnPreview(preview, input.recentSimilarByUserId);
    }
    return preview;
  }

  evaluatePolicy(ctx: CampaignPolicyContext): PolicyDecision {
    return evaluateCampaignPolicy(ctx);
  }

  buildCampaignDraft(input: {
    event: NotificationEvent;
    photographers: PhotographerAudienceInput[];
    audienceContext: CallAudienceContext;
    templateVars: TemplateVariables;
    templateOverrides?: { title?: string | null; body?: string | null };
    policyContext: Omit<CampaignPolicyContext, "eligibleCount" | "callOpen" | "callExpired"> & {
      callOpen?: boolean;
      callExpired?: boolean;
    };
    centerLabel: string;
    eventTitle: string;
    recentSimilarByUserId?: Map<number | string, number>;
    scheduledAt?: Date | string | null;
    campaignIdForAttribution?: string;
  }): CampaignDraft {
    const preview = this.selectAudience({
      photographers: input.photographers,
      context: input.audienceContext,
      recentSimilarByUserId: input.recentSimilarByUserId,
    });

    const policy = evaluateCampaignPolicy({
      ...input.policyContext,
      eligibleCount: preview.buckets.eligible,
      callOpen: input.policyContext.callOpen ?? input.audienceContext.callOpen,
      callExpired:
        input.policyContext.callExpired ?? input.audienceContext.callExpired,
    });

    const rendered = renderNearbyPhotographerCallTemplate(
      input.templateVars,
      input.templateOverrides,
    );

    const schedule = planSchedule({ scheduledAt: input.scheduledAt });
    const campaignDedupeKey = buildCampaignDedupeKey({
      eventType: input.event.type,
      sourceEntityId: input.event.sourceEntityId,
      campaignCycle: input.audienceContext.campaignCycle,
      channels: input.audienceContext.channels,
    });

    const channelLabel = input.audienceContext.channels
      .map((c) => (c === "IN_APP" ? "notificación interna" : c.toLowerCase()))
      .join(", ");

    const deliveries = this.buildDeliveryPlans({
      eligible: preview.eligible,
      audienceContext: input.audienceContext,
      rendered,
      scheduledAt: schedule.scheduledAt,
      campaignIdForAttribution: input.campaignIdForAttribution,
    });

    const metrics = emptyDeliveryMetrics();
    metrics.audience_count = preview.buckets.found;
    metrics.eligible_count = preview.buckets.eligible;

    return {
      event: input.event,
      campaignDedupeKey,
      preview,
      explanation: explainAudienceSelection(preview),
      confirmationText: confirmationSummary({
        eligibleCount: preview.buckets.eligible,
        scopeLabel: preview.scopeLabel,
        centerLabel: input.centerLabel,
        channelLabel,
        eventTitle: input.eventTitle,
      }),
      policy,
      deliveries,
      metrics,
      schedule,
    };
  }

  buildDeliveryPlans(input: {
    eligible: NotificationCandidate[];
    audienceContext: CallAudienceContext;
    rendered: ReturnType<typeof renderNearbyPhotographerCallTemplate>;
    scheduledAt: Date;
    campaignIdForAttribution?: string;
  }): NotificationDeliveryPlan[] {
    return input.eligible.map((c, index) => {
      const userId = c.recipient.userId ?? `anon-${index}`;
      const dedupeKey = buildDeliveryDedupeKey({
        eventType: input.audienceContext.eventType,
        sourceEntityId: input.audienceContext.sourceEntityId,
        recipientUserId: userId,
        channel: c.channel,
        campaignCycle: input.audienceContext.campaignCycle,
      });
      const ctaUrl = input.campaignIdForAttribution
        ? appendAttributionParams(input.rendered.ctaUrl, {
            campaignId: input.campaignIdForAttribution,
            deliveryId: dedupeKey,
          })
        : input.rendered.ctaUrl;

      return {
        recipient: c.recipient,
        channel: c.channel,
        status: "PENDING",
        attempts: 0,
        error: null,
        scheduledAt: input.scheduledAt,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        clickedAt: null,
        dedupeKey,
        title: input.rendered.title,
        body: input.rendered.body,
        ctaUrl,
        ctaLabel: input.rendered.ctaLabel,
      };
    });
  }

  resolveRetry(
    ...args: Parameters<typeof resolveNextDeliveryStatus>
  ): ReturnType<typeof resolveNextDeliveryStatus> {
    return resolveNextDeliveryStatus(...args);
  }
}

export const notificationEngine = new NotificationEngine();

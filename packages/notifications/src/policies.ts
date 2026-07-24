import { ANTI_SPAM_DEFAULTS } from "./config";
import type { AudiencePreview, NotificationCandidate } from "./contracts";

export type AntiSpamLimits = typeof ANTI_SPAM_DEFAULTS;

export type CampaignPolicyContext = {
  campaignsForSourceEntity: number;
  campaignsByActorToday: number;
  eligibleCount: number;
  actorIsDirectorOrSuperAdmin: boolean;
  callOpen: boolean;
  callExpired: boolean;
  limits?: Partial<AntiSpamLimits>;
};

export type PolicyDecision =
  | { ok: true; requiresElevatedConfirm: boolean; warnings: string[] }
  | { ok: false; error: string; code: string };

export function evaluateCampaignPolicy(ctx: CampaignPolicyContext): PolicyDecision {
  const limits = { ...ANTI_SPAM_DEFAULTS, ...ctx.limits };
  const warnings: string[] = [];

  if (!ctx.callOpen) {
    return { ok: false, error: "La convocatoria no está abierta.", code: "CALL_CLOSED" };
  }
  if (ctx.callExpired) {
    return { ok: false, error: "La convocatoria está vencida.", code: "CALL_EXPIRED" };
  }
  if (ctx.campaignsForSourceEntity >= limits.maxCampaignsPerSourceEntity) {
    return {
      ok: false,
      error: `Máximo de ${limits.maxCampaignsPerSourceEntity} campañas por convocatoria.`,
      code: "MAX_CAMPAIGNS_PER_CALL",
    };
  }
  if (ctx.campaignsByActorToday >= limits.maxCampaignsPerActorPerDay) {
    return {
      ok: false,
      error: `Máximo de ${limits.maxCampaignsPerActorPerDay} campañas por día.`,
      code: "MAX_CAMPAIGNS_PER_DAY",
    };
  }
  if (ctx.eligibleCount > limits.maxAudienceHard) {
    return {
      ok: false,
      error: `La audiencia supera el tope duro (${limits.maxAudienceHard}).`,
      code: "AUDIENCE_HARD_CAP",
    };
  }

  let requiresElevatedConfirm = false;
  if (ctx.eligibleCount > limits.maxAudienceSoft) {
    requiresElevatedConfirm = true;
    warnings.push(
      `Esta campaña alcanza a más de ${limits.maxAudienceSoft} usuarios. Requiere autorización de Director o SUPER_ADMIN.`,
    );
    if (!ctx.actorIsDirectorOrSuperAdmin) {
      return {
        ok: false,
        error: warnings[0]!,
        code: "AUDIENCE_NEEDS_DIRECTOR",
      };
    }
  }

  if (ctx.eligibleCount === 0) {
    return {
      ok: false,
      error: "No hay destinatarios elegibles para esta audiencia.",
      code: "EMPTY_AUDIENCE",
    };
  }

  return { ok: true, requiresElevatedConfirm, warnings };
}

/**
 * Filtra elegibles que exceden max avisos similares en ventana.
 */
export function applyRecipientAntiSpam(
  eligible: NotificationCandidate[],
  recentSimilarByUserId: Map<number | string, number>,
  limits: Partial<AntiSpamLimits> = {},
): { kept: NotificationCandidate[]; dropped: NotificationCandidate[] } {
  const max = limits.maxSimilarPerRecipient ?? ANTI_SPAM_DEFAULTS.maxSimilarPerRecipient;
  const kept: NotificationCandidate[] = [];
  const dropped: NotificationCandidate[] = [];

  for (const c of eligible) {
    const uid = c.recipient.userId;
    if (uid == null) {
      kept.push(c);
      continue;
    }
    const count = recentSimilarByUserId.get(uid) ?? 0;
    if (count >= max) {
      dropped.push({
        ...c,
        eligibility: "ANTI_SPAM",
        excludeReason: "Límite de avisos similares",
        selectionReason: "Anti-spam",
      });
    } else {
      kept.push(c);
    }
  }
  return { kept, dropped };
}

export function confirmationSummary(input: {
  eligibleCount: number;
  scopeLabel: string;
  centerLabel: string;
  channelLabel: string;
  eventTitle: string;
}): string {
  return [
    `Se enviará esta convocatoria a ${input.eligibleCount} fotógrafos.`,
    "",
    `Radio: ${input.scopeLabel}`,
    `Centro: ${input.centerLabel}`,
    `Canal: ${input.channelLabel}`,
    `Evento: ${input.eventTitle}`,
  ].join("\n");
}

export function withAntiSpamOnPreview(
  preview: AudiencePreview,
  recentSimilarByUserId: Map<number | string, number>,
  limits?: Partial<AntiSpamLimits>,
): AudiencePreview {
  const { kept, dropped } = applyRecipientAntiSpam(
    preview.eligible,
    recentSimilarByUserId,
    limits,
  );
  if (dropped.length === 0) return preview;
  return {
    ...preview,
    eligible: kept,
    excluded: [...preview.excluded, ...dropped],
    buckets: {
      ...preview.buckets,
      eligible: kept.length,
      excluded: preview.buckets.excluded + dropped.length,
      antiSpam: preview.buckets.antiSpam + dropped.length,
    },
  };
}

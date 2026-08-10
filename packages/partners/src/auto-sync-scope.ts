import type {
  AffectedBenefitsResolution,
  BenefitAudienceScopeHint,
  PartnerBenefitSyncEventPayload,
  PartnerBenefitSyncEventType,
} from "./auto-sync-types";

const PARTICIPANT_KEYS = new Set([
  "EDITION_PARTICIPANTS",
  "CONFIRMED_REGISTRATION",
  "CONFIRMED_EDITION_PARTICIPANTS",
  "CATEGORY",
  "CATEGORY_PARTICIPANTS",
  "EVENT_PARTICIPANTS",
]);

const PURCHASER_KEYS = new Set([
  "PRODUCT_PURCHASERS",
  "EDITION_PURCHASERS",
]);

const WINNER_KEYS = new Set([
  "WINNERS",
  "EDITION_WINNERS",
  "CATEGORY_WINNERS",
  "PRIZE_BUNDLE_WINNERS",
]);

function hasAnyKey(hint: BenefitAudienceScopeHint, keys: Set<string>): boolean {
  return hint.audienceKeys.some((k) => keys.has(k));
}

function matchesCategory(
  hint: BenefitAudienceScopeHint,
  categoryId: string | undefined,
): boolean {
  if (!categoryId) return hasAnyKey(hint, new Set(["CATEGORY", "CATEGORY_PARTICIPANTS"]));
  return hint.categoryIds.includes(categoryId);
}

function matchesWinnerScope(
  hint: BenefitAudienceScopeHint,
  opts: { prizeBundleId?: string; categoryId?: string } = {},
): boolean {
  if (!hasAnyKey(hint, WINNER_KEYS)) return false;

  // Amplias: cualquier evento de ganador.
  if (
    hint.audienceKeys.includes("WINNERS") ||
    hint.audienceKeys.includes("EDITION_WINNERS")
  ) {
    return true;
  }

  let matched = false;
  if (hint.audienceKeys.includes("CATEGORY_WINNERS")) {
    if (!opts.categoryId) matched = true;
    else if (hint.categoryIds.includes(opts.categoryId)) matched = true;
  }
  if (hint.audienceKeys.includes("PRIZE_BUNDLE_WINNERS")) {
    if (!opts.prizeBundleId) matched = true;
    else if (hint.prizeBundleIds.includes(opts.prizeBundleId)) matched = true;
  }
  return matched;
}

/**
 * Resuelve qué beneficios reevaluar a partir de hints de audiencia (sin DB).
 * El adapter Clickatón carga los hints y llama a estas funciones.
 */
export function resolveAffectedBenefitsForRegistrationEvent(input: {
  eventType: PartnerBenefitSyncEventType;
  editionId: string;
  hints: BenefitAudienceScopeHint[];
  categoryId?: string;
  previousCategoryId?: string;
}): AffectedBenefitsResolution {
  const { eventType, editionId, hints } = input;
  let benefitIds: string[] = [];

  if (
    eventType === "CLICKATON_REGISTRATION_CATEGORY_CHANGED"
  ) {
    benefitIds = hints
      .filter(
        (h) =>
          matchesCategory(h, input.categoryId) ||
          matchesCategory(h, input.previousCategoryId) ||
          hasAnyKey(h, PARTICIPANT_KEYS),
      )
      .map((h) => h.benefitId);
  } else if (
    eventType === "CLICKATON_REGISTRATION_CONFIRMED" ||
    eventType === "CLICKATON_REGISTRATION_CREATED" ||
    eventType === "CLICKATON_REGISTRATION_CANCELLED" ||
    eventType === "CLICKATON_REGISTRATION_USER_LINKED"
  ) {
    benefitIds = hints
      .filter(
        (h) =>
          hasAnyKey(h, PARTICIPANT_KEYS) ||
          hasAnyKey(h, PURCHASER_KEYS) ||
          hasAnyKey(h, WINNER_KEYS),
      )
      .map((h) => h.benefitId);
  } else {
    benefitIds = hints.map((h) => h.benefitId);
  }

  return {
    editionId,
    benefitIds: unique(benefitIds),
    reason: eventType,
  };
}

export function resolveAffectedBenefitsForPaymentEvent(input: {
  eventType: Extract<
    PartnerBenefitSyncEventType,
    "CLICKATON_PAYMENT_CONFIRMED" | "CLICKATON_PAYMENT_REVERSED"
  >;
  editionId: string;
  hints: BenefitAudienceScopeHint[];
}): AffectedBenefitsResolution {
  return {
    editionId: input.editionId,
    benefitIds: unique(
      input.hints.filter((h) => hasAnyKey(h, PURCHASER_KEYS)).map((h) => h.benefitId),
    ),
    reason: input.eventType,
  };
}

export function resolveAffectedBenefitsForWinnerEvent(input: {
  eventType: Extract<
    PartnerBenefitSyncEventType,
    "CLICKATON_WINNER_CONFIRMED" | "CLICKATON_WINNER_REVOKED"
  >;
  editionId: string;
  hints: BenefitAudienceScopeHint[];
  prizeBundleId?: string;
  categoryId?: string;
}): AffectedBenefitsResolution {
  return {
    editionId: input.editionId,
    benefitIds: unique(
      input.hints
        .filter((h) =>
          matchesWinnerScope(h, {
            prizeBundleId: input.prizeBundleId,
            categoryId: input.categoryId,
          }),
        )
        .map((h) => h.benefitId),
    ),
    reason: input.eventType,
  };
}

export function resolveAffectedSubjectsForBenefitChange(input: {
  eventType: Extract<
    PartnerBenefitSyncEventType,
    | "PARTNER_BENEFIT_ACTIVATED"
    | "PARTNER_BENEFIT_PAUSED"
    | "PARTNER_BENEFIT_ARCHIVED"
    | "PARTNER_BENEFIT_AUDIENCE_CHANGED"
    | "PARTNER_BENEFIT_VALIDITY_CHANGED"
  >;
  editionId: string;
  benefitId: string;
}): AffectedBenefitsResolution {
  return {
    editionId: input.editionId,
    benefitIds: [input.benefitId],
    reason: input.eventType,
  };
}

/** Despacha al resolver correcto según payload. */
export function resolveAffectedBenefitsFromPayload(input: {
  payload: PartnerBenefitSyncEventPayload;
  hints: BenefitAudienceScopeHint[];
}): AffectedBenefitsResolution {
  const { payload, hints } = input;
  const t = payload.eventType;

  if (t === "CLICKATON_PAYMENT_CONFIRMED" || t === "CLICKATON_PAYMENT_REVERSED") {
    return resolveAffectedBenefitsForPaymentEvent({
      eventType: t,
      editionId: payload.editionId,
      hints,
    });
  }
  if (t === "CLICKATON_WINNER_CONFIRMED" || t === "CLICKATON_WINNER_REVOKED") {
    return resolveAffectedBenefitsForWinnerEvent({
      eventType: t,
      editionId: payload.editionId,
      hints,
      prizeBundleId: payload.prizeBundleId,
      categoryId: payload.categoryId,
    });
  }
  if (
    t === "PARTNER_BENEFIT_ACTIVATED" ||
    t === "PARTNER_BENEFIT_PAUSED" ||
    t === "PARTNER_BENEFIT_ARCHIVED" ||
    t === "PARTNER_BENEFIT_AUDIENCE_CHANGED" ||
    t === "PARTNER_BENEFIT_VALIDITY_CHANGED"
  ) {
    if (!payload.benefitId) {
      return { editionId: payload.editionId, benefitIds: [], reason: t };
    }
    return resolveAffectedSubjectsForBenefitChange({
      eventType: t,
      editionId: payload.editionId,
      benefitId: payload.benefitId,
    });
  }

  return resolveAffectedBenefitsForRegistrationEvent({
    eventType: t,
    editionId: payload.editionId,
    hints,
    categoryId: payload.categoryId,
    previousCategoryId: payload.previousCategoryId,
  });
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

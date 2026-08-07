import { normalizeEligibilityEmail } from "./eligibility-access-key";
import type {
  AudienceEvaluationResult,
  BenefitAudienceInput,
  BenefitEligibilityEvaluation,
  BenefitForEligibility,
  ClickatonEligibilitySnapshot,
  ClickatonRegistrationSubject,
  EligibilitySubjectResult,
} from "./eligibility-types";

function clickatonAudienceKey(audience: BenefitAudienceInput): string {
  const meta = audience.metadata ?? {};
  const fromMeta =
    typeof meta.clickatonAudienceKey === "string" ? meta.clickatonAudienceKey : null;
  if (fromMeta) return fromMeta;
  if (audience.audienceType === "CUSTOM_GROUP" && audience.label) return audience.label;
  return audience.audienceType;
}

function isActiveRegistration(reg: ClickatonRegistrationSubject): boolean {
  if (reg.cancelled) return false;
  const bad = new Set(["CANCELLED", "REFUNDED", "EXPIRED", "DISQUALIFIED", "DRAFT"]);
  return !bad.has(reg.status);
}

function isConfirmed(reg: ClickatonRegistrationSubject): boolean {
  return isActiveRegistration(reg) && reg.status === "CONFIRMED";
}

/**
 * Comprador v1: no existe buyerUserId separado.
 * Proxy documentado: inscripción con pago aprobado, o confirmada free (NOT_REQUIRED).
 * El sujeto es la identidad de la inscripción (no el payer MP).
 */
function isPurchaserProxy(reg: ClickatonRegistrationSubject): boolean {
  if (!isActiveRegistration(reg)) return false;
  if (reg.paymentStatus === "APPROVED") return true;
  if (reg.paymentStatus === "NOT_REQUIRED" && reg.status === "CONFIRMED") return true;
  return false;
}

function resolveIdentity(
  snapshot: ClickatonEligibilitySnapshot,
  userId: number | null,
  email: string | null,
): { userId: number | null; materializable: boolean; reason?: "MISSING_CANONICAL_USER" } {
  if (userId != null && snapshot.knownUserIds.has(userId)) {
    return { userId, materializable: true };
  }
  const norm = normalizeEligibilityEmail(email);
  if (norm && snapshot.emailToUserId.has(norm)) {
    const resolved = snapshot.emailToUserId.get(norm)!;
    if (snapshot.knownUserIds.has(resolved)) {
      return { userId: resolved, materializable: true };
    }
  }
  return {
    userId: null,
    materializable: false,
    reason: "MISSING_CANONICAL_USER",
  };
}

function subjectFromRegistration(
  snapshot: ClickatonEligibilitySnapshot,
  reg: ClickatonRegistrationSubject,
  audienceKey: string,
  reasonCode: EligibilitySubjectResult["reasonCode"],
): EligibilitySubjectResult {
  const identity = resolveIdentity(snapshot, reg.userId, reg.email);
  if (!identity.materializable) {
    return {
      eligible: true,
      materializable: false,
      subjectType: "PENDING_IDENTITY",
      userId: null,
      reasonCode: "MISSING_CANONICAL_USER",
      sourceType: "CLICKATON_REGISTRATION",
      sourceId: reg.registrationId,
      audienceKey,
      registrationId: reg.registrationId,
    };
  }
  return {
    eligible: true,
    materializable: true,
    subjectType: "USER",
    userId: identity.userId,
    reasonCode,
    sourceType: "CLICKATON_REGISTRATION",
    sourceId: reg.registrationId,
    audienceKey,
    registrationId: reg.registrationId,
  };
}

function dedupeSubjects(subjects: EligibilitySubjectResult[]): EligibilitySubjectResult[] {
  const map = new Map<string, EligibilitySubjectResult>();
  for (const s of subjects) {
    const key =
      s.userId != null
        ? `u:${s.userId}:${s.sourceType}:${s.sourceId}`
        : `p:${s.sourceType}:${s.sourceId}`;
    if (!map.has(key)) map.set(key, s);
  }
  return [...map.values()];
}

export function evaluateBenefitAudience(
  audience: BenefitAudienceInput,
  snapshot: ClickatonEligibilitySnapshot,
): AudienceEvaluationResult {
  return evaluateAudience(audience, snapshot);
}

function evaluateAudience(
  audience: BenefitAudienceInput,
  snapshot: ClickatonEligibilitySnapshot,
): AudienceEvaluationResult {
  const audienceKey = clickatonAudienceKey(audience);
  const editionOk =
    audience.contextType === "EDITION" && audience.contextId === snapshot.editionId;

  if (audience.audienceType === "ALL_USERS") {
    return {
      audienceId: audience.id,
      audienceKey,
      evaluable: false,
      deferredReason: "AUDIENCE_NOT_EVALUABLE",
      subjects: [],
    };
  }

  if (audience.audienceType === "ORGANIZATION_MEMBERS") {
    return {
      audienceId: audience.id,
      audienceKey,
      evaluable: false,
      deferredReason: "AUDIENCE_NOT_EVALUABLE",
      subjects: [],
    };
  }

  const evaluableCustomKeys = new Set([
    "CONFIRMED_REGISTRATION",
    "CONFIRMED_EDITION_PARTICIPANTS",
    "CATEGORY",
    "CATEGORY_PARTICIPANTS",
    "WINNERS",
    "EDITION_WINNERS",
    "CATEGORY_WINNERS",
    "PRIZE_BUNDLE_WINNERS",
    "FINALISTS",
    "EDITION_PURCHASERS",
  ]);
  if (
    audienceKey === "STAFF" ||
    audienceKey === "CUSTOM_FUTURE" ||
    (audience.audienceType === "CUSTOM_GROUP" && !evaluableCustomKeys.has(audienceKey))
  ) {
    return {
      audienceId: audience.id,
      audienceKey,
      evaluable: false,
      deferredReason: "AUDIENCE_NOT_EVALUABLE",
      subjects: [],
    };
  }

  if (audience.audienceType === "MANUAL_USERS" || audienceKey === "MANUAL_USERS") {
    if (audience.manualUserId != null && snapshot.knownUserIds.has(audience.manualUserId)) {
      return {
        audienceId: audience.id,
        audienceKey: "MANUAL_USERS",
        evaluable: true,
        subjects: [
          {
            eligible: true,
            materializable: true,
            subjectType: "USER",
            userId: audience.manualUserId,
            reasonCode: "MANUAL_USER",
            sourceType: "AUDIENCE_MANUAL_USER",
            sourceId: String(audience.manualUserId),
            audienceKey: "MANUAL_USERS",
          },
        ],
      };
    }
    return {
      audienceId: audience.id,
      audienceKey: "MANUAL_USERS",
      evaluable: true,
      subjects: [],
    };
  }

  if (!editionOk && audience.audienceType !== "EVENT_PARTICIPANTS") {
    // Permitir EDITION_* solo con context edición correcta
    if (
      ["EDITION_PARTICIPANTS", "PRODUCT_PURCHASERS"].includes(audience.audienceType) ||
      [
        "EDITION_PARTICIPANTS",
        "CONFIRMED_REGISTRATION",
        "PRODUCT_PURCHASERS",
        "CATEGORY",
        "WINNERS",
        "EDITION_WINNERS",
        "CATEGORY_WINNERS",
        "PRIZE_BUNDLE_WINNERS",
        "FINALISTS",
      ].includes(audienceKey)
    ) {
      return {
        audienceId: audience.id,
        audienceKey,
        evaluable: false,
        deferredReason: "SKIPPED_NO_SOURCE",
        subjects: [],
      };
    }
  }

  if (audience.audienceType === "EDITION_PARTICIPANTS" || audienceKey === "EDITION_PARTICIPANTS") {
    const subjects = snapshot.registrations
      .filter((r) => r.editionId === snapshot.editionId && isActiveRegistration(r))
      .map((r) =>
        subjectFromRegistration(snapshot, r, "EDITION_PARTICIPANTS", "EDITION_PARTICIPANT"),
      );
    return {
      audienceId: audience.id,
      audienceKey: "EDITION_PARTICIPANTS",
      evaluable: true,
      subjects: dedupeSubjects(subjects),
    };
  }

  if (
    audienceKey === "CONFIRMED_REGISTRATION" ||
    audienceKey === "CONFIRMED_EDITION_PARTICIPANTS"
  ) {
    const subjects = snapshot.registrations
      .filter((r) => r.editionId === snapshot.editionId && isConfirmed(r))
      .map((r) =>
        subjectFromRegistration(
          snapshot,
          r,
          "CONFIRMED_EDITION_PARTICIPANTS",
          "CONFIRMED_EDITION_PARTICIPANT",
        ),
      );
    return {
      audienceId: audience.id,
      audienceKey: "CONFIRMED_EDITION_PARTICIPANTS",
      evaluable: true,
      subjects: dedupeSubjects(subjects),
    };
  }

  if (
    audience.audienceType === "PRODUCT_PURCHASERS" ||
    audienceKey === "PRODUCT_PURCHASERS" ||
    audienceKey === "EDITION_PURCHASERS"
  ) {
    const subjects = snapshot.registrations
      .filter((r) => r.editionId === snapshot.editionId && isPurchaserProxy(r))
      .map((r) =>
        subjectFromRegistration(snapshot, r, "EDITION_PURCHASERS", "EDITION_PURCHASER"),
      );
    return {
      audienceId: audience.id,
      audienceKey: "EDITION_PURCHASERS",
      evaluable: true,
      subjects: dedupeSubjects(subjects),
    };
  }

  if (audienceKey === "CATEGORY" || audienceKey === "CATEGORY_PARTICIPANTS") {
    const categoryId =
      typeof audience.metadata?.categoryId === "string"
        ? audience.metadata.categoryId
        : null;
    if (!categoryId) {
      return {
        audienceId: audience.id,
        audienceKey: "CATEGORY_PARTICIPANTS",
        evaluable: false,
        deferredReason: "SKIPPED_NO_SOURCE",
        subjects: [],
      };
    }
    const subjects = snapshot.registrations
      .filter(
        (r) =>
          r.editionId === snapshot.editionId &&
          isActiveRegistration(r) &&
          r.categoryIds.includes(categoryId),
      )
      .map((r) =>
        subjectFromRegistration(snapshot, r, "CATEGORY_PARTICIPANTS", "CATEGORY_PARTICIPANT"),
      );
    return {
      audienceId: audience.id,
      audienceKey: "CATEGORY_PARTICIPANTS",
      evaluable: true,
      subjects: dedupeSubjects(subjects),
    };
  }

  if (
    audienceKey === "WINNERS" ||
    audienceKey === "EDITION_WINNERS" ||
    audienceKey === "CATEGORY_WINNERS" ||
    audienceKey === "PRIZE_BUNDLE_WINNERS"
  ) {
    let winners = snapshot.winners;
    if (audienceKey === "CATEGORY_WINNERS") {
      const categoryId =
        typeof audience.metadata?.categoryId === "string"
          ? audience.metadata.categoryId
          : null;
      if (!categoryId) {
        return {
          audienceId: audience.id,
          audienceKey: "CATEGORY_WINNERS",
          evaluable: false,
          deferredReason: "SKIPPED_NO_SOURCE",
          subjects: [],
        };
      }
      winners = winners.filter((w) => w.categoryId === categoryId);
    }
    if (audienceKey === "PRIZE_BUNDLE_WINNERS") {
      const prizeBundleId =
        typeof audience.metadata?.prizeBundleId === "string"
          ? audience.metadata.prizeBundleId
          : null;
      if (!prizeBundleId) {
        return {
          audienceId: audience.id,
          audienceKey: "PRIZE_BUNDLE_WINNERS",
          evaluable: false,
          deferredReason: "SKIPPED_NO_SOURCE",
          subjects: [],
        };
      }
      winners = winners.filter((w) => w.prizeBundleId === prizeBundleId);
    }

    const outKey =
      audienceKey === "EDITION_WINNERS"
        ? "EDITION_WINNERS"
        : audienceKey === "CATEGORY_WINNERS"
          ? "CATEGORY_WINNERS"
          : audienceKey === "PRIZE_BUNDLE_WINNERS"
            ? "PRIZE_BUNDLE_WINNERS"
            : "WINNERS";

    const subjects: EligibilitySubjectResult[] = winners.map((w) => {
      const identity = resolveIdentity(snapshot, w.userId, w.email);
      if (!identity.materializable) {
        return {
          eligible: true,
          materializable: false,
          subjectType: "PENDING_IDENTITY" as const,
          userId: null,
          reasonCode: "MISSING_CANONICAL_USER" as const,
          sourceType: "CLICKATON_PRIZE_ASSIGNMENT" as const,
          sourceId: w.assignmentId,
          audienceKey: outKey,
          registrationId: w.registrationId,
        };
      }
      return {
        eligible: true,
        materializable: true,
        subjectType: "USER" as const,
        userId: identity.userId,
        reasonCode: "WINNER" as const,
        sourceType: "CLICKATON_PRIZE_ASSIGNMENT" as const,
        sourceId: w.assignmentId,
        audienceKey: outKey,
        registrationId: w.registrationId,
      };
    });
    return {
      audienceId: audience.id,
      audienceKey: outKey,
      evaluable: true,
      subjects: dedupeSubjects(subjects),
    };
  }

  if (audienceKey === "FINALISTS") {
    if (snapshot.finalists.length === 0) {
      return {
        audienceId: audience.id,
        audienceKey: "FINALISTS",
        evaluable: false,
        deferredReason: "AUDIENCE_NOT_EVALUABLE",
        subjects: [],
      };
    }
    const subjects: EligibilitySubjectResult[] = snapshot.finalists.map((f) => {
      const identity = resolveIdentity(snapshot, f.userId, f.email);
      if (!identity.materializable) {
        return {
          eligible: true,
          materializable: false,
          subjectType: "PENDING_IDENTITY" as const,
          userId: null,
          reasonCode: "MISSING_CANONICAL_USER" as const,
          sourceType: "FOTORANK_RESULT_ENTRY" as const,
          sourceId: f.resultEntryId,
          audienceKey: "FINALISTS",
          registrationId: f.registrationId,
        };
      }
      return {
        eligible: true,
        materializable: true,
        subjectType: "USER" as const,
        userId: identity.userId,
        reasonCode: "FINALIST" as const,
        sourceType: "FOTORANK_RESULT_ENTRY" as const,
        sourceId: f.resultEntryId,
        audienceKey: "FINALISTS",
        registrationId: f.registrationId,
      };
    });
    return {
      audienceId: audience.id,
      audienceKey: "FINALISTS",
      evaluable: true,
      subjects: dedupeSubjects(subjects),
    };
  }

  return {
    audienceId: audience.id,
    audienceKey,
    evaluable: false,
    deferredReason: "AUDIENCE_NOT_EVALUABLE",
    subjects: [],
  };
}

export function isBenefitEligibleForMaterialization(
  benefit: BenefitForEligibility,
  now = new Date(),
): { benefitActive: boolean; withinWindow: boolean } {
  const benefitActive = benefit.status === "ACTIVE" && benefit.archivedAt == null;
  const withinWindow =
    (!benefit.startsAt || benefit.startsAt.getTime() <= now.getTime()) &&
    (!benefit.endsAt || benefit.endsAt.getTime() >= now.getTime());
  return { benefitActive, withinWindow };
}

export function evaluateBenefitEligibility(input: {
  benefit: BenefitForEligibility;
  snapshot: ClickatonEligibilitySnapshot;
  now?: Date;
}): BenefitEligibilityEvaluation {
  const now = input.now ?? new Date();
  const { benefitActive, withinWindow } = isBenefitEligibleForMaterialization(
    input.benefit,
    now,
  );
  const audiences = input.benefit.audiences.map((a) => evaluateAudience(a, input.snapshot));
  const notEvaluableAudiences = audiences.filter((a) => !a.evaluable);
  const eligibleSubjects = dedupeSubjects(audiences.flatMap((a) => a.subjects));
  const materializableSubjects = eligibleSubjects.filter((s) => s.materializable && s.userId);
  const pendingIdentity = eligibleSubjects.filter((s) => !s.materializable);

  return {
    benefitId: input.benefit.id,
    editionId: input.snapshot.editionId,
    benefitActive,
    withinWindow,
    audiences,
    eligibleSubjects,
    materializableSubjects,
    pendingIdentity,
    notEvaluableAudiences,
  };
}

export function explainBenefitEligibility(evaluation: BenefitEligibilityEvaluation): string {
  const parts = [
    `benefit=${evaluation.benefitId}`,
    `active=${evaluation.benefitActive}`,
    `window=${evaluation.withinWindow}`,
    `eligible=${evaluation.eligibleSubjects.length}`,
    `materializable=${evaluation.materializableSubjects.length}`,
    `pendingIdentity=${evaluation.pendingIdentity.length}`,
    `notEvaluable=${evaluation.notEvaluableAudiences.length}`,
  ];
  return parts.join(" ");
}

export function listEligibleSubjects(
  evaluation: BenefitEligibilityEvaluation,
): EligibilitySubjectResult[] {
  return evaluation.eligibleSubjects;
}

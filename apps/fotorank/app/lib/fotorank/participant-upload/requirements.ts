import { resolveCategoryPresentation } from "../contest-public-presentation/category-semantics";
import {
  parseUploadPolicy,
  type UploadPolicy,
} from "../entries/upload-policy";
import { formatParticipantDate } from "../participant-experience/dates";
import {
  resolveUploadWindow,
  type UploadWindowView,
} from "../participant-experience/upload-window";
import { formatBytes } from "./format";
import type { UploadRequirementsSummary } from "./types";

export function buildUploadRequirementsSummary(input: {
  contestSlug: string;
  categoryName: string;
  categorySlug: string;
  maxFiles: number;
  uploadPolicyJson: unknown;
  uploadWindow: UploadWindowView;
  basesHref: string;
  timezone?: string | null;
}): UploadRequirementsSummary {
  const policy = parseUploadPolicy(input.uploadPolicyJson);
  const sem = resolveCategoryPresentation({
    id: "cat",
    name: input.categoryName,
    slug: input.categorySlug,
    description: null,
    maxFiles: input.maxFiles,
  });

  const formatsLabel = policy.allowedExtensions.map((e) => e.toUpperCase()).join(", ");
  const captureStart = policy.captureWindowStartsAt
    ? formatParticipantDate(policy.captureWindowStartsAt, {
        includeTime: false,
        timeZone: input.timezone,
      })
    : null;
  const captureEnd = policy.captureWindowEndsExclusiveAt
    ? formatParticipantDate(policy.captureWindowEndsExclusiveAt, {
        includeTime: false,
        timeZone: input.timezone,
      })
    : null;

  return {
    categoryName: input.categoryName,
    categorySlug: input.categorySlug,
    maxFiles: input.maxFiles,
    formatsLabel,
    maxSizeLabel: formatBytes(policy.maxFileSizeBytes),
    minDimensionsLabel: `${policy.minWidth} × ${policy.minHeight} px`,
    maxDimensionsLabel: `${policy.maxWidth} × ${policy.maxHeight} px`,
    minMegapixelsLabel: `${policy.minMegapixels} MP`,
    uploadWindow: input.uploadWindow,
    allowReplace: policy.allowReplaceUntilSubmissionClose,
    specialBadges: [
      ...new Set([
        ...(sem.primaryLabel ? [sem.primaryLabel] : []),
        ...sem.badges.filter((b) => b.key !== "max-files").map((b) => b.label),
      ]),
    ],
    requirementNotes: sem.requirementNote ? [sem.requirementNote] : [],
    basesHref: input.basesHref,
    policy,
    requiresSantaFeEligibility:
      input.contestSlug === "santa-fe-en-foco" || input.contestSlug.includes("santa-fe"),
    capturePeriodLabel:
      captureStart && captureEnd
        ? `${captureStart} – ${captureEnd}`
        : captureStart
          ? `Desde ${captureStart}`
          : null,
    // Se propaga para que el cliente formatee en la hora del concurso y no en
    // la del navegador (ver nota en UploadRequirementsSummary.timezone).
    timezone: input.timezone ?? null,
  };
}

export function canStartUpload(input: {
  registrationStatus: string;
  uploadWindow: UploadWindowView;
  uploadedCount: number;
  maxFiles: number;
  admissionStatus?: string | null;
  frozen?: boolean;
}): { allowed: boolean; reason: string | null } {
  if (input.registrationStatus !== "CONFIRMED") {
    return { allowed: false, reason: "Tu inscripción debe estar confirmada." };
  }
  if (!input.uploadWindow.isOpen) {
    return { allowed: false, reason: "La carga todavía no está habilitada." };
  }
  if (input.frozen || input.admissionStatus === "FROZEN_FOR_JURY") {
    return { allowed: false, reason: "La obra está congelada y no admite cargas." };
  }
  if (input.uploadedCount >= input.maxFiles && input.maxFiles > 0) {
    // Con 1 slot, el reemplazo puede seguir permitido — el caller decide.
    return { allowed: true, reason: null };
  }
  return { allowed: true, reason: null };
}

export function fixtureOpenUploadWindow(now = new Date()): UploadWindowView {
  return resolveUploadWindow(
    {
      submissionOpensAt: new Date(now.getTime() - 86_400_000),
      submissionDeadline: new Date(now.getTime() + 86_400_000 * 30),
      registrationOpensAt: new Date(now.getTime() - 86_400_000 * 60),
      registrationClosesAt: null,
      startAt: new Date(now.getTime() - 86_400_000 * 60),
      status: "PUBLISHED",
    },
    now,
  );
}

export function defaultFixturePolicy(): UploadPolicy {
  return parseUploadPolicy(null);
}

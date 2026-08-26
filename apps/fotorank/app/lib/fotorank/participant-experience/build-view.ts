import { resolveCategoryPresentation } from "../contest-public-presentation";
import { registrationNeedsRulesReacceptance } from "../registration/rules-reacceptance";
import { resolveParticipantNextAction, resolveSecondaryActions } from "./next-action";
import { resolveNextStepBlock } from "./next-step-copy";
import { resolveParticipantProgress } from "./progress";
import { presentPrimaryParticipationStatus } from "./status-labels";
import type { ParticipantEntrySlice, ParticipantParticipationView } from "./types";
import { resolveUploadWindow, type UploadWindowInput } from "./upload-window";

export type BuildParticipationInput = {
  id: string;
  contestId: string;
  contestTitle: string;
  contestSlug: string;
  registrationNumber: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  maxFiles: number;
  registrationStatus: string;
  paymentStatus: string;
  registeredAt: Date | null;
  confirmedAt: Date | null;
  entry: ParticipantEntrySlice | null;
  acceptedRulesVersionId: string;
  currentRulesVersionId: string | null;
  contest: UploadWindowInput & {
    timezone: string | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    submissionOpensAt: Date | null;
    submissionDeadline: Date | null;
    judgingStartAt: Date | null;
    judgingEndAt: Date | null;
    resultsAt: Date | null;
  };
  resultsPublished?: boolean;
  now?: Date;
  surface?: "list" | "detail";
};

export function buildParticipantParticipationView(
  input: BuildParticipationInput,
): ParticipantParticipationView {
  const now = input.now ?? new Date();
  const upload = resolveUploadWindow(input.contest, now);
  const resultsPublished = Boolean(input.resultsPublished);
  const hasJudgingWindow = Boolean(input.contest.judgingStartAt || input.contest.resultsAt);
  const needsRulesReacceptance = registrationNeedsRulesReacceptance({
    acceptedRulesVersionId: input.acceptedRulesVersionId,
    currentPublishedRulesVersionId: input.currentRulesVersionId,
  });

  const actionInput = {
    registrationId: input.id,
    contestSlug: input.contestSlug,
    registrationStatus: input.registrationStatus,
    entryStatus: input.entry?.status,
    manualReviewStatus: input.entry?.manualReviewStatus,
    admissionStatus: input.entry?.admissionStatus,
    upload,
    resultsPublished,
    needsRulesReacceptance,
    surface: input.surface ?? "list",
  };

  const primaryStatus = presentPrimaryParticipationStatus({
    registrationStatus: input.registrationStatus,
    entryStatus: input.entry?.status,
    manualReviewStatus: input.entry?.manualReviewStatus,
    admissionStatus: input.entry?.admissionStatus,
  });

  const uploadedCount = input.entry ? 1 : 0;

  return {
    id: input.id,
    contestId: input.contestId,
    contestTitle: input.contestTitle,
    contestSlug: input.contestSlug,
    registrationNumber: input.registrationNumber,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    categorySlug: input.categorySlug,
    maxFiles: input.maxFiles,
    registrationStatus: input.registrationStatus,
    paymentStatus: input.paymentStatus,
    registeredAt: input.registeredAt,
    confirmedAt: input.confirmedAt,
    entry: input.entry,
    upload,
    timezone: input.contest.timezone,
    dates: {
      registrationOpensAt: input.contest.registrationOpensAt,
      registrationClosesAt: input.contest.registrationClosesAt,
      submissionOpensAt: input.contest.submissionOpensAt,
      submissionDeadline: input.contest.submissionDeadline,
      judgingStartAt: input.contest.judgingStartAt,
      judgingEndAt: input.contest.judgingEndAt,
      resultsAt: input.contest.resultsAt,
    },
    resultsPublished,
    primaryStatus,
    nextAction: resolveParticipantNextAction(actionInput),
    secondaryActions: resolveSecondaryActions(actionInput),
    progress: resolveParticipantProgress({
      registrationStatus: input.registrationStatus,
      entryStatus: input.entry?.status,
      manualReviewStatus: input.entry?.manualReviewStatus,
      admissionStatus: input.entry?.admissionStatus,
      upload,
      resultsPublished,
      hasJudgingWindow,
    }),
    nextStep: resolveNextStepBlock({
      registrationStatus: input.registrationStatus,
      categoryName: input.categoryName,
      maxFiles: input.maxFiles,
      entryStatus: input.entry?.status,
      manualReviewStatus: input.entry?.manualReviewStatus,
      publicRejectionReason: input.entry?.publicRejectionReason,
      upload,
      timezone: input.contest.timezone,
      needsRulesReacceptance,
    }),
    needsRulesReacceptance,
    acceptedRulesVersionId: input.acceptedRulesVersionId,
    currentRulesVersionId: input.currentRulesVersionId,
    categoryPresentation: resolveCategoryPresentation({
      id: input.categoryId,
      name: input.categoryName,
      slug: input.categorySlug,
      description: null,
      maxFiles: input.maxFiles,
    }),
    uploadedCount,
  };
}

import type { CategoryPublicPresentation } from "../contest-public-presentation";
import type { ParticipantNextAction } from "./next-action";
import type { NextStepBlock } from "./next-step-copy";
import type { ParticipantProgressStep } from "./progress";
import type { ParticipantStatusPresentation } from "./status-labels";
import type { UploadWindowView } from "./upload-window";

export type ParticipantEntrySlice = {
  id: string;
  status: string;
  entryNumber: string | null;
  technicalSummaryStatus: string | null;
  manualReviewStatus: string | null;
  admissionStatus: string | null;
  publicRejectionReason: string | null;
};

export type ParticipantParticipationView = {
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
  upload: UploadWindowView;
  timezone: string | null;
  dates: {
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    submissionOpensAt: Date | null;
    submissionDeadline: Date | null;
    judgingStartAt: Date | null;
    judgingEndAt: Date | null;
    resultsAt: Date | null;
  };
  resultsPublished: boolean;
  primaryStatus: ParticipantStatusPresentation;
  nextAction: ParticipantNextAction;
  secondaryActions: ParticipantNextAction[];
  progress: ParticipantProgressStep[];
  nextStep: NextStepBlock;
  categoryPresentation: CategoryPublicPresentation;
  uploadedCount: number;
  /** True si la inscripción aceptó una versión distinta a la PUBLISHED vigente. */
  needsRulesReacceptance: boolean;
  acceptedRulesVersionId: string;
  currentRulesVersionId: string | null;
};

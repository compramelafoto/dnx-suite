import type { UploadWindowView } from "./upload-window";

export type ProgressStepState = "completed" | "current" | "upcoming" | "locked" | "na";

export type ParticipantProgressStep = {
  key: "registration" | "upload" | "review" | "evaluation" | "results";
  label: string;
  state: ProgressStepState;
};

export type ProgressInput = {
  registrationStatus: string;
  entryStatus?: string | null;
  manualReviewStatus?: string | null;
  admissionStatus?: string | null;
  upload: UploadWindowView;
  resultsPublished?: boolean;
  hasJudgingWindow?: boolean;
};

/**
 * Secuencia compacta. No marca etapas como completadas sin evidencia.
 */
export function resolveParticipantProgress(input: ProgressInput): ParticipantProgressStep[] {
  const cancelled =
    input.registrationStatus === "CANCELLED" || input.registrationStatus === "DISQUALIFIED";
  const confirmed = input.registrationStatus === "CONFIRMED";
  const hasEntry = Boolean(input.entryStatus);
  const entryConfirmed =
    input.entryStatus === "CONFIRMED" ||
    input.admissionStatus === "ADMITTED" ||
    input.admissionStatus === "FROZEN_FOR_JURY";
  const inReview =
    input.manualReviewStatus === "REPLACEMENT_REQUESTED" ||
    input.manualReviewStatus === "PENDING" ||
    input.entryStatus === "REQUIRES_REVIEW" ||
    input.admissionStatus === "PENDING_MANUAL_REVIEW" ||
    input.admissionStatus === "PENDING_AUTOMATIC_REVIEW";
  const inEvaluation = input.admissionStatus === "FROZEN_FOR_JURY";
  const results = Boolean(input.resultsPublished);

  const registrationState: ProgressStepState = cancelled
    ? "locked"
    : confirmed
      ? "completed"
      : "current";

  let uploadState: ProgressStepState = "upcoming";
  if (cancelled) uploadState = "locked";
  else if (!confirmed) uploadState = "locked";
  else if (entryConfirmed) uploadState = "completed";
  else if (hasEntry && input.upload.isOpen) uploadState = "current";
  else if (!hasEntry && input.upload.isOpen) uploadState = "current";
  else if (!hasEntry && !input.upload.isOpen) uploadState = "locked";
  else if (hasEntry && !input.upload.isOpen) uploadState = "completed";

  let reviewState: ProgressStepState = "na";
  if (hasEntry || inReview || entryConfirmed) {
    if (cancelled) reviewState = "locked";
    else if (entryConfirmed || inEvaluation || results) reviewState = "completed";
    else if (inReview || (hasEntry && entryConfirmed === false && input.entryStatus === "CONFIRMED"))
      reviewState = "current";
    else if (hasEntry && input.entryStatus === "CONFIRMED") reviewState = "current";
    else if (hasEntry) reviewState = "upcoming";
    else reviewState = "upcoming";
  }

  // Refine review: CONFIRMED entry waiting admission = current review
  if (
    !cancelled &&
    input.entryStatus === "CONFIRMED" &&
    !entryConfirmed &&
    input.admissionStatus !== "REJECTED"
  ) {
    reviewState = "current";
  }
  if (input.admissionStatus === "ADMITTED") reviewState = "completed";
  if (input.admissionStatus === "REJECTED") reviewState = "completed";

  let evaluationState: ProgressStepState = "na";
  if (input.hasJudgingWindow || inEvaluation || results) {
    if (cancelled) evaluationState = "locked";
    else if (results) evaluationState = "completed";
    else if (inEvaluation) evaluationState = "current";
    else if (input.admissionStatus === "ADMITTED" || input.admissionStatus === "FROZEN_FOR_JURY")
      evaluationState = inEvaluation ? "current" : "upcoming";
    else evaluationState = "upcoming";
  }

  let resultsState: ProgressStepState = "na";
  if (input.hasJudgingWindow || results || input.resultsPublished === false) {
    // Show results step when contest has results date context OR published
    if (cancelled) resultsState = "locked";
    else if (results) resultsState = "completed";
    else if (inEvaluation) resultsState = "upcoming";
    else resultsState = "upcoming";
  }
  // Only include results if we have judging or published flag provided
  const showResults = results || Boolean(input.hasJudgingWindow);
  if (!showResults) resultsState = "na";

  const steps: ParticipantProgressStep[] = [
    { key: "registration", label: "Inscripción", state: registrationState },
    { key: "upload", label: "Carga", state: uploadState },
  ];

  if (reviewState !== "na") {
    steps.push({ key: "review", label: "Revisión", state: reviewState });
  }
  if (evaluationState !== "na") {
    steps.push({ key: "evaluation", label: "Evaluación", state: evaluationState });
  }
  if (resultsState !== "na") {
    steps.push({ key: "results", label: "Resultados", state: resultsState });
  }

  // Ensure exactly one "current" when possible
  const hasCurrent = steps.some((s) => s.state === "current");
  if (!hasCurrent && confirmed && !cancelled) {
    const lockedUpload = steps.find((s) => s.key === "upload" && s.state === "locked");
    if (lockedUpload && input.upload.phase === "not_yet_open") {
      // Stay on completed registration as visual focus — mark upload locked is enough
    }
  }

  return steps;
}

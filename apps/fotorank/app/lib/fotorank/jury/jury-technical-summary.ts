import {
  JURY_ALLOWED_CHECK_CODES,
  type JuryAllowedCheck,
  type JuryTechnicalSummaryView,
} from "./serialize-entry-for-juror";

type CheckRow = {
  checkCode: string;
  checkGroup: string;
  status: string;
  title: string;
  message: string;
};

type MetaRow = {
  metadataStatus: string;
  orientation: string | null;
  software: string | null;
} | null;

/**
 * Filtra checklist/metadata para el jurado.
 * Sin GPS, hash, filename, raw metadata ni identidad.
 */
export function buildJuryTechnicalSummary(input: {
  technicalSummaryStatus: string;
  width: number | null;
  height: number | null;
  checks: CheckRow[];
  metadata: MetaRow;
  manualReviewStatus: string;
  evaluationStatus: JuryTechnicalSummaryView["evaluationStatus"];
}): JuryTechnicalSummaryView {
  const allowedChecks: JuryAllowedCheck[] = input.checks
    .filter((c) => JURY_ALLOWED_CHECK_CODES.has(c.checkCode))
    .map((c) => ({
      checkCode: c.checkCode,
      checkGroup: c.checkGroup,
      status: c.status,
      title: c.title,
      message: c.message,
    }));

  const fileValid = !allowedChecks.some(
    (c) => c.checkGroup === "FILE" && c.status === "FAIL",
  );
  const orientationCheck = allowedChecks.find((c) => c.checkCode === "FILE_ORIENTATION");
  const deviceCheck = allowedChecks.find((c) => c.checkCode === "CAT_DEVICE" || c.checkCode === "META_DEVICE");
  const softwareCheck = allowedChecks.find((c) => c.checkCode === "META_SOFTWARE");
  const warningCount = allowedChecks.filter(
    (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
  ).length;

  const exifAvailable =
    input.metadata != null &&
    (input.metadata.metadataStatus === "EXTRACTED" || input.metadata.metadataStatus === "PARTIAL");

  return {
    technicalSummaryStatus: input.technicalSummaryStatus,
    fileValid,
    width: input.width,
    height: input.height,
    orientation: input.metadata?.orientation ?? orientationCheck?.message ?? null,
    exifAvailable,
    deviceCompatibility: deviceCheck?.status === "PASS" ? "compatible" : deviceCheck?.status === "WARNING" ? "probable" : deviceCheck ? "not_verifiable" : null,
    editingSoftwareWarning: Boolean(
      softwareCheck && (softwareCheck.status === "WARNING" || /lightroom|photoshop|snapseed/i.test(input.metadata?.software ?? "")),
    ),
    manualReviewApproved:
      input.manualReviewStatus === "APPROVED" || input.manualReviewStatus === "CLEARED_WARNING",
    requiresReview: input.technicalSummaryStatus === "REQUIRES_REVIEW",
    warningCount,
    allowedChecks,
    evaluationStatus: input.evaluationStatus,
    evaluationEnabled: false,
    evaluationMessage: "Evaluación aún no habilitada (rúbricas pendientes).",
  };
}

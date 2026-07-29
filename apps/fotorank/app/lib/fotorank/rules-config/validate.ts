import type { ContestRulesConfiguration, ValidationFinding, ValidationResult } from "./types";

export function validateContestRulesConfiguration(config: ContestRulesConfiguration): ValidationResult {
  const findings: ValidationFinding[] = [];

  const regOpen = Date.parse(config.schedule.registrationOpensAt);
  const regClose = Date.parse(config.schedule.registrationClosesAtExclusive);
  const subOpen = Date.parse(config.schedule.submissionOpensAt);
  const subClose = Date.parse(config.schedule.submissionClosesAtExclusive);

  if (!(regOpen < regClose)) {
    findings.push({
      code: "SCHEDULE_REG_ORDER",
      severity: "error",
      message: "Cierre de inscripción debe ser posterior a la apertura (límite exclusivo).",
      path: "schedule.registrationClosesAtExclusive",
    });
  }
  if (!(subOpen < subClose)) {
    findings.push({
      code: "SCHEDULE_SUB_ORDER",
      severity: "error",
      message: "Cierre de carga debe ser posterior a la apertura.",
      path: "schedule.submissionClosesAtExclusive",
    });
  }

  if (config.schedule.captureWindowStartsAt && config.schedule.captureWindowEndsExclusiveAt) {
    const c0 = Date.parse(config.schedule.captureWindowStartsAt);
    const c1 = Date.parse(config.schedule.captureWindowEndsExclusiveAt);
    if (!(c0 < c1)) {
      findings.push({
        code: "CAPTURE_WINDOW",
        severity: "error",
        message: "Ventana de captura inválida.",
        path: "schedule.captureWindowEndsExclusiveAt",
      });
    }
  }

  if (config.participation.pricingMode === "FREE") {
    if (config.participation.priceAmountMinor !== 0) {
      findings.push({
        code: "FREE_PRICE",
        severity: "error",
        message: "FREE no puede tener precio > 0.",
        path: "participation.priceAmountMinor",
      });
    }
  }
  if (config.participation.pricingMode === "PAID" && config.participation.priceAmountMinor <= 0) {
    findings.push({
      code: "PAID_PRICE",
      severity: "error",
      message: "PAID requiere precio > 0.",
      path: "participation.priceAmountMinor",
    });
  }

  if (!config.categories.length) {
    findings.push({ code: "NO_CATEGORIES", severity: "error", message: "Debe haber al menos una categoría." });
  }
  for (const cat of config.categories) {
    if (!cat.name.trim() || !cat.slug.trim()) {
      findings.push({
        code: "CATEGORY_NAME",
        severity: "error",
        message: "Categoría sin nombre o slug.",
        path: `categories.${cat.slug}`,
      });
    }
    if (cat.maxEntries !== config.participation.maxEntriesPerRegistration) {
      findings.push({
        code: "CATEGORY_ENTRY_MISMATCH",
        severity: "error",
        message: `Categoría ${cat.slug}: maxEntries distinto de la participación.`,
        path: `categories.${cat.slug}.maxEntries`,
      });
    }
  }

  if (
    config.metadata.exifGeneral.level === "REQUIRED" &&
    config.metadata.exifGeneral.missingAction === "ALLOW"
  ) {
    findings.push({
      code: "EXIF_REQUIRED_ALLOW",
      severity: "error",
      message: "EXIF REQUIRED no puede permitir ausencia.",
      path: "metadata.exifGeneral",
    });
  }

  if (config.ai.fullyGeneratedImage === "PROHIBITED" && config.ai.generativeFill === "ALLOWED") {
    findings.push({
      code: "AI_INCONSISTENT",
      severity: "error",
      message: "IA generativa prohibida pero relleno generativo permitido.",
      path: "ai.generativeFill",
    });
  }

  if (config.editing.photomontage !== "PROHIBITED" && config.theme.summary.toLowerCase().includes("documental")) {
    findings.push({
      code: "PHOTOMONTAGE_DOC",
      severity: "warning",
      message: "Concurso documental: fotomontaje debería estar prohibido.",
      path: "editing.photomontage",
    });
  }

  if (config.rights.licenseMandatory && config.rights.allowCommercial && !config.rights.durationMonths) {
    findings.push({
      code: "LICENSE_DURATION",
      severity: "error",
      message: "Licencia comercial sin duración.",
      path: "rights.durationMonths",
    });
  }

  if (config.participation.minorsAllowed === true && config.participation.adultAuthorizationPendingHumanConfirmation) {
    findings.push({
      code: "MINORS_AUTH_PENDING",
      severity: "pending_human",
      message: "Menores permitidos pero autorización de adulto pendiente de confirmación humana.",
      path: "participation.adultAuthorizationRequired",
    });
  }

  if (config.participation.minorsAllowed === true && config.participation.adultAuthorizationRequired === null) {
    findings.push({
      code: "MINORS_POLICY",
      severity: "pending_human",
      message: "Falta política definitiva de autorización de menores.",
      path: "participation.adultAuthorizationRequired",
    });
  }

  if (config.jury.judgesPendingHumanConfirmation || config.jury.maxJudges == null) {
    findings.push({
      code: "JURY_COUNT",
      severity: "pending_human",
      message: "Cantidad de jurados no confirmada formalmente.",
      path: "jury.maxJudges",
    });
  }

  if (config.file.maxFileSizeBytes == null) {
    findings.push({
      code: "NO_REG_SIZE_LIMIT",
      severity: "warning",
      message: "Sin límite reglamentario de peso (OK si es intencional).",
      path: "file.maxFileSizeBytes",
    });
  }

  if (!config.file.supportedMimeTypes.length) {
    findings.push({
      code: "NO_FORMATS",
      severity: "error",
      message: "Sin formatos soportados por el pipeline.",
      path: "file.supportedMimeTypes",
    });
  }

  if (config.rights.exclusive && config.rights.licenseAppliesToAllWorks) {
    findings.push({
      code: "EXCLUSIVE_BROAD",
      severity: "warning",
      message: "Licencia exclusiva amplia: revisión jurídica recomendada.",
      path: "rights.exclusive",
    });
  }

  for (const flag of config.rights.legalReviewFlags) {
    findings.push({ code: "LEGAL_FLAG", severity: "warning", message: flag, path: "rights.legalReviewFlags" });
  }

  const hasError = findings.some((f) => f.severity === "error");
  const hasPending = findings.some((f) => f.severity === "pending_human");
  const hasWarning = findings.some((f) => f.severity === "warning");

  let status: ValidationResult["status"] = "VALID";
  if (hasError) status = "INVALID";
  else if (hasPending) status = "PENDING_HUMAN_CONFIRMATION";
  else if (hasWarning) status = "VALID_WITH_WARNINGS";

  return { status, findings };
}

export function assertPublishable(result: ValidationResult): void {
  if (result.status === "INVALID" || result.status === "PENDING_HUMAN_CONFIRMATION") {
    throw new Error(`Configuración no publicable: ${result.status}`);
  }
}

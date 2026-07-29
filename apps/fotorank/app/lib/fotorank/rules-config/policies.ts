import type { ContestRulesConfiguration } from "./types";

/** Política de inscripción derivada de la configuración publicada. */
export function buildRegistrationPolicy(config: ContestRulesConfiguration) {
  return {
    pricingMode: config.participation.pricingMode,
    priceAmountMinor: config.participation.priceAmountMinor,
    currency: config.participation.currency,
    platformFeeBps: config.participation.platformFeeBps,
    registrationOpensAt: new Date(config.schedule.registrationOpensAt),
    /** Cierre exclusivo → el instante de cierre no está abierto; almacenamos closesAt = exclusive - 1ms para compat. */
    registrationClosesAt: new Date(Date.parse(config.schedule.registrationClosesAtExclusive) - 1),
    registrationClosesAtExclusive: new Date(config.schedule.registrationClosesAtExclusive),
    maxRegistrationsPerPerson: config.participation.maxRegistrationsPerPerson,
    maxCategoriesPerRegistration: config.participation.maxCategoriesPerRegistration,
    allowWithdrawal: config.participation.allowWithdrawal,
    residencyRequired: config.participation.residencyRequired,
    residencyScope: config.participation.residencyScope,
    minAge: config.participation.minAge,
    timezone: config.schedule.timezone,
  };
}

export function buildEntryUploadPolicy(config: ContestRulesConfiguration) {
  return {
    allowedMimeTypes: config.file.supportedMimeTypes,
    allowedExtensions: config.file.supportedExtensions,
    /** Reglamentario: null. Interno: safety. */
    maxFileSizeBytesRegulatory: config.file.maxFileSizeBytes,
    maxFileSizeBytes: config.file.internalSafetyMaxFileSizeBytes,
    minWidth: config.file.minWidth,
    minHeight: config.file.minHeight,
    maxWidth: config.file.maxWidth,
    maxHeight: config.file.maxHeight,
    minMegapixels: config.file.minMegapixels,
    maxEntriesPerRegistration: config.participation.maxEntriesPerRegistration,
    allowReplaceUntilSubmissionClose: config.participation.allowReplaceUntilClose,
    submissionOpensAt: new Date(config.schedule.submissionOpensAt),
    submissionClosesAt: new Date(Date.parse(config.schedule.submissionClosesAtExclusive) - 1),
    submissionClosesAtExclusive: new Date(config.schedule.submissionClosesAtExclusive),
    captureWindowStartsAt: config.schedule.captureWindowStartsAt
      ? new Date(config.schedule.captureWindowStartsAt)
      : null,
    captureWindowEndsExclusiveAt: config.schedule.captureWindowEndsExclusiveAt
      ? new Date(config.schedule.captureWindowEndsExclusiveAt)
      : null,
    draftConfig: false,
    regulatoryNote: config.file.note,
  };
}

export function buildMetadataPolicy(config: ContestRulesConfiguration) {
  return {
    requireExif: config.metadata.exifGeneral.level === "REQUIRED",
    requireCaptureDate: config.metadata.captureDate.level === "REQUIRED",
    requireGps: config.metadata.gps.level === "REQUIRED",
    exif: config.metadata.exifGeneral,
    captureDate: config.metadata.captureDate,
    gps: config.metadata.gps,
    deviceModel: config.metadata.deviceModel,
    /** Ausencia de EXIF nunca REJECT automático en SF. */
    missingExifBlocksUpload: config.metadata.exifGeneral.missingAction === "REJECT",
  };
}

export function buildEditingPolicy(config: ContestRulesConfiguration) {
  return {
    photomontage: config.editing.photomontage,
    generativeContentProhibited: config.ai.fullyGeneratedImage === "PROHIBITED",
    basicDevelopAllowed: config.editing.exposure === "ALLOWED",
    masksForDevelopOnly: true,
    editing: config.editing,
    ai: config.ai,
  };
}

export function buildRightsPolicy(config: ContestRulesConfiguration) {
  return {
    licenseMandatory: config.rights.licenseMandatory,
    licenseAppliesToAllWorks: config.rights.licenseAppliesToAllWorks,
    exclusive: config.rights.exclusive,
    durationMonths: config.rights.durationMonths,
    attributionRequired: config.rights.attributionRequired,
    authorRetainsOwnership: config.rights.authorRetainsOwnership,
    archivalHeritagePermanentForSelected: config.rights.archivalHeritagePermanentForSelected,
    legalReviewFlags: config.rights.legalReviewFlags,
  };
}

export function buildJuryPolicy(config: ContestRulesConfiguration) {
  return {
    anonymizedEvaluation: config.jury.anonymizedEvaluation,
    conflictOfInterestEnabled: config.jury.conflictOfInterestEnabled,
    decisionFinal: config.jury.decisionFinal,
    maxJudges: config.jury.maxJudges,
    minJudges: config.jury.minJudges,
    perCategory: config.jury.perCategory,
  };
}

/** Payload compatible con uploadPolicyJson histórico. */
export function toLegacyUploadPolicyJson(config: ContestRulesConfiguration) {
  const upload = buildEntryUploadPolicy(config);
  const meta = buildMetadataPolicy(config);
  return {
    allowedMimeTypes: upload.allowedMimeTypes,
    allowedExtensions: upload.allowedExtensions,
    maxFileSizeBytes: upload.maxFileSizeBytes,
    minWidth: upload.minWidth,
    minHeight: upload.minHeight,
    maxWidth: upload.maxWidth,
    maxHeight: upload.maxHeight,
    minMegapixels: upload.minMegapixels,
    requireExif: meta.requireExif,
    requireCaptureDate: meta.requireCaptureDate,
    requireGps: meta.requireGps,
    allowEditedFiles: config.editing.exposure === "ALLOWED",
    maxEntriesPerRegistration: upload.maxEntriesPerRegistration,
    allowReplaceUntilSubmissionClose: upload.allowReplaceUntilSubmissionClose,
    draftConfig: false,
    notes: config.file.note,
    source: "ContestRulesConfiguration",
  };
}

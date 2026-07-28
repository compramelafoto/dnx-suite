export const CAPABILITY_VIEW_ADMISSION = "canViewTechnicalAdmission";
export const CAPABILITY_REVIEW_ADMISSION = "canReviewTechnicalAdmission";
export const CAPABILITY_ADMIT_ENTRIES = "canAdmitEntries";
export const CAPABILITY_REJECT_ENTRIES = "canRejectEntries";
export const CAPABILITY_EXCLUDE_ENTRIES = "canExcludeEntries";
export const CAPABILITY_CLOSE_BATCH = "canCloseAdmissionBatch";
export const CAPABILITY_REOPEN_BATCH = "canReopenAdmissionBatch";
export const CAPABILITY_RESOLVE_IDENTITY = "canResolveEntryIdentity";

export const ADMISSION_CAPABILITIES = [
  CAPABILITY_VIEW_ADMISSION,
  CAPABILITY_REVIEW_ADMISSION,
  CAPABILITY_ADMIT_ENTRIES,
  CAPABILITY_REJECT_ENTRIES,
  CAPABILITY_EXCLUDE_ENTRIES,
  CAPABILITY_CLOSE_BATCH,
  CAPABILITY_REOPEN_BATCH,
  CAPABILITY_RESOLVE_IDENTITY,
] as const;

export type AdmissionCapability = (typeof ADMISSION_CAPABILITIES)[number];

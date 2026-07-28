export const CAPABILITY_VIEW_ACCREDITATION = "canViewEditionAccreditation";
export const CAPABILITY_CHECK_IN = "canCheckInParticipants";
export const CAPABILITY_VERIFY_IDENTITY = "canVerifyParticipantIdentity";
export const CAPABILITY_DELIVER_KIT = "canDeliverEditionKit";
export const CAPABILITY_REVERSE_CHECKIN = "canReverseAccreditation";
export const CAPABILITY_GRANT_EXCEPTION = "canGrantAccreditationException";
export const CAPABILITY_MANAGE_DEVICES = "canManageAccreditationDevices";

export const ACCREDITATION_CAPABILITIES = [
  CAPABILITY_VIEW_ACCREDITATION,
  CAPABILITY_CHECK_IN,
  CAPABILITY_VERIFY_IDENTITY,
  CAPABILITY_DELIVER_KIT,
  CAPABILITY_REVERSE_CHECKIN,
  CAPABILITY_GRANT_EXCEPTION,
  CAPABILITY_MANAGE_DEVICES,
] as const;

export type AccreditationCapability = (typeof ACCREDITATION_CAPABILITIES)[number];

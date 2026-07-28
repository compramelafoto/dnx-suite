export type TimelineEventType =
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSE"
  | "ACCREDITATION_OPEN"
  | "ACCREDITATION_CLOSE"
  | "MARATHON_START"
  | "PROMPT_RELEASE"
  | "CAPTURE_WINDOW_CLOSE"
  | "UPLOAD_WINDOW_OPEN"
  | "UPLOAD_WINDOW_CLOSE"
  | "MARATHON_END"
  | "JUDGING_OPEN"
  | "JUDGING_CLOSE"
  | "RESULTS_RELEASE"
  | "CUSTOM";

export type TimelineEventView = {
  id: string;
  eventType: TimelineEventType;
  name: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  sequence: number;
  isCritical: boolean;
  visibilityPolicy: string;
  triggerMode: string;
  manuallyReleasedAt: Date | null;
};

export type PromptRecord = {
  id: string;
  editionId: string;
  sequence: number;
  internalName: string;
  title: string | null;
  instructions: string | null;
  shortDescription: string | null;
  imageAssetId: string | null;
  videoAssetId: string | null;
  audioAssetId: string | null;
  captureStartsAt: Date | null;
  captureEndsAt: Date | null;
  uploadEndsAt: Date | null;
  releaseMode: string;
  status: string;
  releasedAt: Date | null;
  contentVersion: number;
};

/** DTO seguro — nunca incluye título/instrucciones/assets. */
export type LockedPromptPublicDto = {
  sequence: number;
  status: "LOCKED";
  opensAt: string | null;
  serverNow: string;
  message: string;
};

export type ReleasedPromptPublicDto = {
  sequence: number;
  status: "RELEASED";
  title: string;
  instructions: string;
  shortDescription: string | null;
  captureEndsAt: string | null;
  uploadEndsAt: string | null;
  assets: Array<{ kind: string; assetId: string }>;
  serverNow: string;
};

export type ClosedPromptPublicDto = {
  sequence: number;
  status: "CLOSED";
  title: string | null;
  serverNow: string;
  message: string;
};

export type PromptPublicDto =
  | LockedPromptPublicDto
  | ReleasedPromptPublicDto
  | ClosedPromptPublicDto;

export type PublicTimelineMilestoneDto = {
  eventType: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  status: "PENDING_CONFIG" | "UPCOMING" | "OPEN" | "CLOSED" | "RELEASED";
};

export type EditionTemporalStateDto = {
  timezone: string;
  serverNow: string;
  timelineVersion: number | null;
  timelineStatus: string | null;
  paused: boolean;
  nextEvent: PublicTimelineMilestoneDto | null;
  milestones: PublicTimelineMilestoneDto[];
  canRegister: boolean | null;
  canCheckIn: boolean | null;
  canUpload: boolean | null;
};

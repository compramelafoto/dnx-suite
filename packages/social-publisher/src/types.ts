/** Plataformas soportadas (arquitectura; solo Instagram implementado). */
export type SocialPlatform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "THREADS"
  | "LINKEDIN"
  | "X"
  | "TIKTOK";

export type SocialApplication =
  | "CLICKATON"
  | "FOTORANK"
  | "COMPRAMELAFOTO"
  | "INFOSPOT"
  | "FOTOOFFICE"
  | "SPONSOR"
  | "ORGANIZER"
  | "DNX";

export type PublishRequestStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED"
  | "REJECTED";

export type SocialAccountStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "PENDING"
  | "DISABLED";

export type PublishPriority = "LOW" | "NORMAL" | "HIGH";

export type PublishAssetKind = "IMAGE" | "VIDEO" | "CAROUSEL_ITEM";

/** Cómo se publica el conjunto de assets. Sin especificar, una imagen sola. */
export type PublishFormat = "SINGLE_IMAGE" | "CAROUSEL" | "STORY";

export type PublishAsset = {
  assetId: string;
  kind: PublishAssetKind;
  publicUrl: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder?: number;
};

export type PublishTarget = {
  platform: SocialPlatform;
  socialAccountId: string;
};

export type CreatePublishRequestInput = {
  application: SocialApplication;
  entityType: string;
  entityId: string;
  templateRef?: string | null;
  caption: string;
  hashtags?: string[];
  mentions?: string[];
  assets: PublishAsset[];
  target: PublishTarget;
  scheduleAt?: Date | null;
  timezone?: string | null;
  approvalRequired?: boolean;
  priority?: PublishPriority;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  createdByUserId?: number | null;
};

export type PublishRequest = {
  id: string;
  application: SocialApplication;
  entityType: string;
  entityId: string;
  templateRef: string | null;
  caption: string;
  hashtags: string[];
  mentions: string[];
  assets: PublishAsset[];
  target: PublishTarget;
  status: PublishRequestStatus;
  priority: PublishPriority;
  approvalRequired: boolean;
  scheduleAt: Date | null;
  timezone: string | null;
  approvedAt: Date | null;
  approvedByUserId: number | null;
  rejectedAt: Date | null;
  rejectedByUserId: number | null;
  rejectionReason: string | null;
  publishedAt: Date | null;
  externalMediaId: string | null;
  externalPostId: string | null;
  permalink: string | null;
  attemptCount: number;
  nextRetryAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SocialAccount = {
  id: string;
  platform: SocialPlatform;
  ownerUserId: number;
  externalAccountId: string;
  businessId: string | null;
  username: string | null;
  displayName: string | null;
  scopes: string[];
  status: SocialAccountStatus;
  expiresAt: Date | null;
  lastValidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublishResult = {
  ok: boolean;
  dryRun: boolean;
  externalMediaId?: string | null;
  externalPostId?: string | null;
  permalink?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  providerRawSanitized?: Record<string, unknown> | null;
};

export type PublishAttempt = {
  id: string;
  publishRequestId: string;
  attemptNumber: number;
  startedAt: Date;
  finishedAt: Date | null;
  ok: boolean;
  dryRun: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
};

export class SocialPublisherError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "SocialPublisherError";
  }
}

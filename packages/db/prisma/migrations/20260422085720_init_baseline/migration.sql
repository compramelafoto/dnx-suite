-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "UpsellCapability" AS ENUM ('DIGITAL_SALES', 'PRINT_SALES', 'RETOUCH_PRO', 'EXPRESS_DELIVERY', 'STORAGE_EXTEND');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PUBLIC_SESSION', 'PRIVATE_SESSION', 'SPORTS', 'PUBLIC_PHOTOGRAPHY', 'THEMATIC_SESSIONS', 'COMMERCIAL_SESSIONS', 'SCHOOL', 'RELIGIOUS', 'FESTIVAL', 'CONFERENCE', 'CONCERT', 'CORPORATE', 'OTHER', 'WEDDING', 'BIRTHDAY', 'GRADUATION');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EventJoinPolicy" AS ENUM ('OPEN', 'REQUEST', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "EventMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('PICKUP', 'SHIPPING');

-- CreateEnum
CREATE TYPE "UpsellStrategyStatus" AS ENUM ('DRAFT', 'QA', 'BETA', 'APPROVED');

-- CreateEnum
CREATE TYPE "AlbumCollaboratorRole" AS ENUM ('COLLABORATOR');

-- CreateEnum
CREATE TYPE "EventMemberRole" AS ENUM ('ORGANIZER', 'PHOTOGRAPHER');

-- CreateEnum
CREATE TYPE "EventSimilarityStatus" AS ENUM ('SUGGESTED', 'MERGED_MANUALLY', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlbumInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PrintPricingSource" AS ENUM ('PHOTOGRAPHER', 'LAB_PREFERRED');

-- CreateEnum
CREATE TYPE "PhotoAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "PreCompraOrderStatus" AS ENUM ('CREATED', 'PAID_HELD', 'CANCELED');

-- CreateEnum
CREATE TYPE "PreCompraOrderItemStatus" AS ENUM ('WAITING_SELFIE', 'WAITING_UPLOAD', 'APPROVED_BY_MATCH', 'WAITING_SELECTION', 'READY_TO_DESIGN', 'DESIGN_SUBMITTED', 'NEEDS_CHANGES', 'APPROVED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "ApprovalProof" AS ENUM ('FACE_MATCH', 'SELECTION');

-- CreateEnum
CREATE TYPE "PhotoClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DesignProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'APPROVED', 'DRAFT_RENDERING', 'PENDING_PHOTOGRAPHER_APPROVAL', 'APPROVED_FOR_EXPORT', 'NEEDS_ADJUSTMENT', 'EXPORTING', 'EXPORTED');

-- CreateEnum
CREATE TYPE "DesignPreviewStatus" AS ENUM ('IDLE', 'RENDERING', 'READY', 'FAILED', 'DIRTY');

-- CreateEnum
CREATE TYPE "DesignPreviewJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DesignRevisionCreatedBy" AS ENUM ('CLIENT', 'PHOTOGRAPHER');

-- CreateEnum
CREATE TYPE "HiddenAlbumAttemptResult" AS ENUM ('NO_FACE', 'MULTIPLE_FACES', 'MATCH_FOUND', 'NO_MATCH', 'EXPIRED_SESSION', 'RATE_LIMITED', 'ERROR');

-- CreateEnum
CREATE TYPE "HiddenAlbumDeviceType" AS ENUM ('MOBILE', 'DESKTOP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OrderItemType" AS ENUM ('DIGITAL', 'PRINT', 'FRAME');

-- CreateEnum
CREATE TYPE "AlbumAccessRole" AS ENUM ('VIEWER');

-- CreateEnum
CREATE TYPE "ProductMaterial" AS ENUM ('CANVAS', 'WOOD');

-- CreateEnum
CREATE TYPE "FulfillmentMode" AS ENUM ('PICKUP_ONLY', 'SHIP_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('AUTO', 'WHOLESALE', 'RETAIL');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PHOTOGRAPHER', 'LAB', 'CUSTOMER', 'LAB_PHOTOGRAPHER', 'ORGANIZER', 'SUPER_ADMIN', 'WORKSPACE_ADMIN', 'STAFF', 'TEACHER_MANAGER', 'COURSE_MANAGER');

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_SUPPORT', 'USER');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "SuiteApp" AS ENUM ('FOTOFFICE', 'COMPRAMELAFOTO', 'FOTORANK');

-- CreateEnum
CREATE TYPE "SuiteAppRole" AS ENUM ('PHOTOGRAPHER', 'LAB', 'CUSTOMER', 'ORGANIZER_ADMIN', 'JURY', 'PARTICIPANT', 'CRM_ADMIN', 'COURSE_MANAGER', 'SALES_ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PrintFinish" AS ENUM ('BRILLO', 'MATE');

-- CreateEnum
CREATE TYPE "PrintOrderStatus" AS ENUM ('CREATED', 'IN_PRODUCTION', 'READY', 'READY_TO_PICKUP', 'SHIPPED', 'DELIVERED', 'CANCELED', 'RETIRED');

-- CreateEnum
CREATE TYPE "PrintOrderOwnerType" AS ENUM ('PHOTOGRAPHER', 'LAB');

-- CreateEnum
CREATE TYPE "PickupBy" AS ENUM ('CLIENT', 'PHOTOGRAPHER');

-- CreateEnum
CREATE TYPE "PrintOrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LabApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DRAFT', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LabType" AS ENUM ('TYPE_A', 'TYPE_B');

-- CreateEnum
CREATE TYPE "MercadoPagoOwnerType" AS ENUM ('USER', 'LAB');

-- CreateEnum
CREATE TYPE "PrintOrderType" AS ENUM ('DIGITAL', 'PRINT', 'COMBO');

-- CreateEnum
CREATE TYPE "AlbumExtensionRequester" AS ENUM ('CLIENT_PUBLIC', 'PHOTOGRAPHER', 'LAB_PHOTOGRAPHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RemovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentSplitStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EmailQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'CREATE_ACCOUNT');

-- CreateEnum
CREATE TYPE "ZipJobType" AS ENUM ('ORDER_DOWNLOAD', 'ALBUM_DOWNLOAD', 'CUSTOM_PHOTOS');

-- CreateEnum
CREATE TYPE "ZipJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DownloadTokenType" AS ENUM ('CLIENT_DIGITAL', 'LAB_PRINT');

-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESO', 'RECTIFICACION', 'SUPRESION', 'OCULTAR_FOTO', 'BAJA_MARKETING', 'DESACTIVAR_BIOMETRIA');

-- CreateEnum
CREATE TYPE "PrivacyRequestRelationship" AS ENUM ('TITULAR', 'PADRE_MADRE_TUTOR');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommunityProfileType" AS ENUM ('PHOTOGRAPHER_SERVICE', 'EVENT_VENDOR');

-- CreateEnum
CREATE TYPE "CommunityProfileStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CommunitySubmissionStatus" AS ENUM ('PENDING', 'APPLIED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "FotorankOrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'JUDGE', 'VIEWER');

-- CreateEnum
CREATE TYPE "FotorankMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'INVITED', 'DECLINED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FotorankContestStatus" AS ENUM ('DRAFT', 'SETUP_IN_PROGRESS', 'READY_TO_PUBLISH', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FotorankContestVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "FotorankJudgeAccountStatus" AS ENUM ('INVITED', 'PENDING_REGISTRATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FotorankJudgeMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FotorankJudgeInvitationStatus" AS ENUM ('DRAFT', 'SENT', 'OPENED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FotorankJudgeAssignmentType" AS ENUM ('PRIMARY', 'BACKUP');

-- CreateEnum
CREATE TYPE "FotorankJudgeAssignmentStatus" AS ENUM ('ASSIGNED', 'INVITATION_SENT', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'EXTENDED', 'REPLACED_BY_BACKUP');

-- CreateEnum
CREATE TYPE "FotorankJudgeMethodType" AS ENUM ('SCORE_1_5', 'SCORE_1_10', 'SCORE_0_100', 'YES_NO', 'FAVORITES_SELECTION', 'SELECTION_WITH_QUOTA', 'CRITERIA_BASED');

-- CreateEnum
CREATE TYPE "FotorankJudgeActorType" AS ENUM ('ADMIN', 'JUDGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FotorankJudgeCompensationMode" AS ENUM ('VOLUNTEER', 'PAID', 'BOTH');

-- CreateEnum
CREATE TYPE "FotorankJudgePricingMode" AS ENUM ('FIXED', 'STARTING_AT', 'NEGOTIABLE', 'NOT_SHOWN');

-- CreateEnum
CREATE TYPE "FotorankJudgePriceUnit" AS ENUM ('PER_CONTEST', 'PER_CATEGORY', 'PER_HOUR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FotorankJudgeDirectoryInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FotorankGlobalCategoryReviewStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "FotorankContestCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseSalesModality" AS ENUM ('LIVE', 'RECORDED', 'HYBRID');

-- CreateEnum
CREATE TYPE "CourseSalesLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "CourseSalesCourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');

-- CreateEnum
CREATE TYPE "CourseSalesLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "ServiceLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'INTERESTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "FotorankDiplomaTemplateStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FotorankDiplomaRecipientType" AS ENUM ('PARTICIPANT', 'ENTRY', 'JUDGE', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "FotorankDiplomaIssuedStatus" AS ENUM ('ISSUED', 'FAILED', 'REVOKED', 'REPLACED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PHOTOGRAPHER',
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handler" TEXT,
    "isPublicPageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "preferredLabId" INTEGER,
    "primaryColor" TEXT,
    "profitMarginPercent" DOUBLE PRECISION,
    "publicPageHandler" TEXT,
    "secondaryColor" TEXT,
    "fontColor" TEXT,
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "companyName" TEXT,
    "companyOwner" TEXT,
    "country" TEXT,
    "cuit" TEXT,
    "phone" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "enableAlbumsPage" BOOLEAN NOT NULL DEFAULT false,
    "enablePrintPage" BOOLEAN NOT NULL DEFAULT false,
    "showCarnetPrints" BOOLEAN NOT NULL DEFAULT false,
    "showPolaroidPrints" BOOLEAN NOT NULL DEFAULT false,
    "tertiaryColor" TEXT,
    "headerBackgroundColor" TEXT,
    "footerBackgroundColor" TEXT,
    "heroBackgroundColor" TEXT,
    "pageBackgroundColor" TEXT,
    "companyAddress" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "website" TEXT,
    "whatsapp" TEXT,
    "digitalDiscount10Plus" DOUBLE PRECISION,
    "digitalDiscount20Plus" DOUBLE PRECISION,
    "digitalDiscount5Plus" DOUBLE PRECISION,
    "digitalDiscountsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultDigitalPhotoPrice" INTEGER,
    "mpAccessToken" TEXT,
    "mpConnectedAt" TIMESTAMP(3),
    "mpRefreshToken" TEXT,
    "mpUserId" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "passwordResetExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "googleId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "platformCommissionPercentOverride" INTEGER,
    "cbu" TEXT,
    "cbuTitular" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT,
    "marketingOptInAt" TIMESTAMP(3),
    "marketingOptInIp" TEXT,
    "marketingOptInSource" TEXT,
    "faceConsent" BOOLEAN NOT NULL DEFAULT false,
    "faceConsentAt" TIMESTAMP(3),
    "faceConsentIp" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceJson" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toUserId" INTEGER,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotographerSalesSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "digitalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "printsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "retouchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expressEnabled" BOOLEAN NOT NULL DEFAULT false,
    "storageExtendEnabled" BOOLEAN NOT NULL DEFAULT false,
    "printsPriceListJson" JSONB,
    "printsFulfillmentJson" JSONB,
    "retouchPricingJson" JSONB,
    "expressPricingJson" JSONB,
    "storageExtendPricingJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerSalesSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotographerProduct" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "acabado" TEXT,
    "retailPrice" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "eventDate" TIMESTAMP(3),
    "publicSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" INTEGER,
    "eventId" INTEGER,
    "type" "EventType",
    "geohash" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "city" TEXT,
    "deliveryType" "DeliveryType",
    "albumProfitMarginPercent" DOUBLE PRECISION,
    "printPricingSource" "PrintPricingSource" NOT NULL DEFAULT 'PHOTOGRAPHER',
    "coverPhotoId" INTEGER,
    "digitalPhotoPriceCents" INTEGER,
    "pickupBy" "PickupBy",
    "selectedLabId" INTEGER,
    "enableDigitalPhotos" BOOLEAN NOT NULL DEFAULT true,
    "enablePrintedPhotos" BOOLEAN NOT NULL DEFAULT true,
    "includeDigitalWithPrint" BOOLEAN NOT NULL DEFAULT false,
    "digitalWithPrintDiscountPercent" DOUBLE PRECISION DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "showComingSoonMessage" BOOLEAN NOT NULL DEFAULT false,
    "firstPhotoDate" TIMESTAMP(3),
    "digitalDiscount10Plus" DOUBLE PRECISION,
    "digitalDiscount20Plus" DOUBLE PRECISION,
    "digitalDiscount5Plus" DOUBLE PRECISION,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowClientLabSelection" BOOLEAN NOT NULL DEFAULT false,
    "expirationExtensionDays" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reactivatedAt" TIMESTAMP(3),
    "reactivationCount" INTEGER NOT NULL DEFAULT 0,
    "coverCropX" DOUBLE PRECISION,
    "coverCropY" DOUBLE PRECISION,
    "coverCropZoom" DOUBLE PRECISION,
    "coverCropAspect" DOUBLE PRECISION,
    "coverThumbnailKey" TEXT,
    "maxDownloadAllowed" INTEGER,
    "hiddenPhotosEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hiddenSelfieRetentionDays" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "preCompraCloseAt" TIMESTAMP(3),
    "requireClientApproval" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" INTEGER,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumSalesSettings" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "inheritFromPhotographer" BOOLEAN NOT NULL DEFAULT true,
    "allowedCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disabledCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumSalesSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellStrategy" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "UpsellStrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "enabledGlobally" BOOLEAN NOT NULL DEFAULT false,
    "requiresCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresConfigKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rulesJson" JSONB,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "rolloutAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpsellStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserUpsellConfig" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "strategyId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUpsellConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumCollaborator" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "AlbumCollaboratorRole" NOT NULL DEFAULT 'COLLABORATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumSlugAlias" (
    "id" SERIAL NOT NULL,
    "aliasSlug" TEXT NOT NULL,
    "targetAlbumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "locationName" TEXT,
    "city" TEXT NOT NULL,
    "geohash" TEXT,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
    "joinPolicy" "EventJoinPolicy" NOT NULL DEFAULT 'OPEN',
    "maxPhotographers" INTEGER,
    "expectedAttendees" INTEGER,
    "creatorId" INTEGER NOT NULL,
    "promoCommitment" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "accreditationNotes" TEXT,
    "shareSlug" TEXT,
    "coverImageKey" TEXT,
    "mergedIntoId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMember" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "EventMemberRole" NOT NULL,
    "status" "EventMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSimilarity" (
    "id" SERIAL NOT NULL,
    "eventAId" INTEGER NOT NULL,
    "eventBId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" "EventSimilarityStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSimilarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerDownloadAllowance" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "usedDownloads" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerDownloadAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotobookDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotobookDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumInvitation" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedByUserId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" INTEGER,
    "status" "AlbumInvitationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "AlbumInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumAccess" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "AlbumAccessRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCourse" (
    "id" SERIAL NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "sellDigital" BOOLEAN NOT NULL DEFAULT true,
    "sellPrint" BOOLEAN NOT NULL DEFAULT true,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,
    "analysisStatus" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAnalysisJob" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "status" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "runAfter" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrToken" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "textRaw" TEXT NOT NULL,
    "textNorm" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceDetection" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "rekognitionFaceId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "bbox" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerUserId" INTEGER,
    "buyerPhone" TEXT,
    "claimedAt" TIMESTAMP(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extensionSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "mpPaymentId" TEXT,
    "platformCommissionCents" INTEGER DEFAULT 0,
    "pricingSnapshot" JSONB,
    "referralFeeDiscountCents" INTEGER,
    "digitalDeliveredAt" TIMESTAMP(3),
    "downloadLinkViewedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbandonedOrderReminder" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "templateUsed" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonedOrderReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderFulfillmentGroup" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'PICKUP',
    "pickupAddress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFulfillmentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "fulfillmentGroupId" INTEGER,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "finish" TEXT,
    "material" "ProductMaterial",
    "productType" "OrderItemType" NOT NULL DEFAULT 'DIGITAL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumProduct" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "mockupUrl" TEXT,
    "minFotos" INTEGER NOT NULL DEFAULT 1,
    "maxFotos" INTEGER NOT NULL DEFAULT 1,
    "requiresDesign" BOOLEAN NOT NULL DEFAULT false,
    "suggestionText" TEXT,
    "defaultTemplateId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreCompraOrder" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerUserId" INTEGER,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "schoolCourseId" INTEGER,
    "studentFirstName" TEXT,
    "studentLastName" TEXT,
    "status" "PreCompraOrderStatus" NOT NULL DEFAULT 'CREATED',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCompraOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreCompraOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "albumProductId" INTEGER NOT NULL,
    "subjectId" INTEGER,
    "status" "PreCompraOrderItemStatus" NOT NULL DEFAULT 'WAITING_SELFIE',
    "approvalProof" "ApprovalProof",
    "approvedAt" TIMESTAMP(3),
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCompraOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "schoolCourseId" INTEGER,
    "createdByOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectSelfie" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectSelfie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoFace" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "bbox" JSONB NOT NULL,
    "faceExternalId" TEXT,
    "faceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoFace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceMatch" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "photoFaceId" INTEGER,
    "confidence" DOUBLE PRECISION,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoClaim" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "PhotoClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionPhoto" (
    "id" SERIAL NOT NULL,
    "selectionId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "position" INTEGER DEFAULT 0,
    "role" TEXT,
    "subjectId" INTEGER,

    CONSTRAINT "SelectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER,
    "albumProductId" INTEGER,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "greenColorHex" TEXT NOT NULL DEFAULT '#00ff00',
    "tolerance" INTEGER NOT NULL DEFAULT 30,
    "widthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "safeAreaConfigJson" JSONB,
    "textElementsJson" JSONB,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT,
    "pagesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSlot" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "index" INTEGER NOT NULL,
    "role" TEXT,
    "bbox" JSONB NOT NULL,
    "maskPngUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignProject" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    "status" "DesignProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedForExportRevisionId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" INTEGER,
    "reviewReason" TEXT,
    "reviewNote" TEXT,
    "previewUrl" TEXT,
    "previewDirty" BOOLEAN NOT NULL DEFAULT true,
    "previewStatus" "DesignPreviewStatus" NOT NULL DEFAULT 'IDLE',
    "previewGeneratedAt" TIMESTAMP(3),
    "previewVersion" INTEGER NOT NULL DEFAULT 0,
    "previewError" TEXT,
    "exportUrlJpg" TEXT,
    "exportUrlPdf" TEXT,
    "exportGeneratedAt" TIMESTAMP(3),
    "exportVersion" INTEGER NOT NULL DEFAULT 0,
    "exportError" TEXT,

    CONSTRAINT "DesignProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignRevision" (
    "id" SERIAL NOT NULL,
    "designProjectId" INTEGER NOT NULL,
    "createdBy" "DesignRevisionCreatedBy" NOT NULL DEFAULT 'CLIENT',
    "dataJson" JSONB,
    "exportedJpgUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignPreviewJob" (
    "id" TEXT NOT NULL,
    "designRevisionId" INTEGER NOT NULL,
    "status" "DesignPreviewJobStatus" NOT NULL DEFAULT 'PENDING',
    "targetVersion" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignPreviewJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignExportJob" (
    "id" TEXT NOT NULL,
    "designProjectId" INTEGER NOT NULL,
    "designRevisionId" INTEGER NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "targetVersion" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintOrder" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labId" INTEGER,
    "photographerId" INTEGER,
    "ownerType" "PrintOrderOwnerType",
    "ownerId" INTEGER,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "pickupBy" "PickupBy" NOT NULL DEFAULT 'CLIENT',
    "status" "PrintOrderStatus" NOT NULL DEFAULT 'CREATED',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "total" INTEGER NOT NULL DEFAULT 0,
    "paymentProvider" TEXT,
    "paymentStatus" "PrintOrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "mpPaymentId" TEXT,
    "clientId" INTEGER,
    "internalNotes" TEXT,
    "labCommission" INTEGER,
    "orderType" "PrintOrderType" NOT NULL DEFAULT 'PRINT',
    "photographerCommission" INTEGER,
    "platformCommission" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricingSnapshot" JSONB,
    "referralFeeDiscountCents" INTEGER,

    CONSTRAINT "PrintOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintOrderItem" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "originalName" TEXT,
    "size" TEXT NOT NULL,
    "acabado" TEXT NOT NULL DEFAULT 'BRILLO',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "printExpiresAt" TIMESTAMP(3),

    CONSTRAINT "PrintOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'Argentina',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublicPageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showCarnetPrints" BOOLEAN NOT NULL DEFAULT false,
    "showPolaroidPrints" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "publicPageHandler" TEXT,
    "secondaryColor" TEXT,
    "tertiaryColor" TEXT,
    "fontColor" TEXT,
    "userId" INTEGER,
    "approvalStatus" "LabApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "mpAccessToken" TEXT,
    "mpConnectedAt" TIMESTAMP(3),
    "mpRefreshToken" TEXT,
    "mpUserId" TEXT,
    "commissionOverrideBps" INTEGER,
    "internalNotes" TEXT,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "labType" "LabType" NOT NULL DEFAULT 'TYPE_B',
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultSlaDays" INTEGER,
    "fulfillmentMode" "FulfillmentMode" NOT NULL DEFAULT 'PICKUP_ONLY',
    "radiusKm" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "soyFotografo" BOOLEAN NOT NULL DEFAULT false,
    "usePriceForPhotographerOrders" "PriceMode" NOT NULL DEFAULT 'AUTO',

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabRecommendation" (
    "id" SERIAL NOT NULL,
    "photographerName" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "labEmail" TEXT NOT NULL,
    "labWhatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "LabRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabBasePrice" (
    "id" SERIAL NOT NULL,
    "labId" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabBasePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSizeDiscount" (
    "id" SERIAL NOT NULL,
    "labId" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'PROFESSIONAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabSizeDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabProduct" (
    "id" SERIAL NOT NULL,
    "labId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "photographerPrice" INTEGER NOT NULL,
    "retailPrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acabado" TEXT,

    CONSTRAINT "LabProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabProductVariant" (
    "id" SERIAL NOT NULL,
    "labId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "size" TEXT,
    "finish" "PrintFinish",
    "material" "ProductMaterial",
    "slaDays" INTEGER NOT NULL DEFAULT 5,
    "priceRetailArs" INTEGER,
    "priceWholesaleArs" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "minDigitalPhotoPrice" INTEGER NOT NULL DEFAULT 5000,
    "platformCommissionPercent" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminCommissionRetailPercent" DOUBLE PRECISION DEFAULT 10,
    "adminCommissionWholesalePercent" DOUBLE PRECISION DEFAULT 8,
    "commissionDigital_Bps" INTEGER NOT NULL DEFAULT 1000,
    "commissionPro_Bps" INTEGER,
    "commissionPublicTypeA_Bps" INTEGER NOT NULL DEFAULT 750,
    "commissionPublicTypeB_Bps" INTEGER NOT NULL DEFAULT 1000,
    "downloadLinkDays" INTEGER NOT NULL DEFAULT 30,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "photoDeletionDays" INTEGER NOT NULL DEFAULT 45,
    "stuckOrderDays" INTEGER NOT NULL DEFAULT 7,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappMaxPhotosToSend" INTEGER NOT NULL DEFAULT 10,
    "whatsappSendInitialMessage" BOOLEAN NOT NULL DEFAULT true,
    "whatsappSendFinalMessage" BOOLEAN NOT NULL DEFAULT true,
    "whatsappSendDownloadLinkForLargeOrders" BOOLEAN NOT NULL DEFAULT true,
    "whatsappDeliveryEnabledForPaidOrders" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppDeliveryLog" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "waMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumNotification" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "notifiedWhenReady" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt3Weeks" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt2Weeks" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt1Week" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "lastName" TEXT,
    "whatsapp" TEXT,

    CONSTRAINT "AlbumNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumExtension" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "requestedByUserId" INTEGER,
    "requestedByRole" "AlbumExtensionRequester" NOT NULL DEFAULT 'CLIENT_PUBLIC',
    "daysAdded" INTEGER NOT NULL DEFAULT 30,
    "notifiedAt15Days" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt29Days" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MercadoPagoOAuthState" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "ownerType" "MercadoPagoOwnerType" NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MercadoPagoOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemovalRequest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "status" "RemovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterPhone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "declarationOk" BOOLEAN NOT NULL DEFAULT false,
    "albumId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "decidedByUserId" INTEGER,
    "decisionNote" TEXT,

    CONSTRAINT "RemovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" INTEGER NOT NULL,
    "actorRole" "Role" NOT NULL,
    "actorEmail" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "printOrderId" INTEGER,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReplyEmailSentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "printOrderId" INTEGER,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT,
    "requesterEmail" TEXT,
    "requesterName" TEXT,
    "requesterPhone" TEXT,
    "requesterRole" TEXT,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "instagram" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "message" TEXT NOT NULL,
    "documentUrl" TEXT,
    "photographerId" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "labId" INTEGER,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintOrderStatusHistory" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printOrderId" INTEGER NOT NULL,
    "status" "PrintOrderStatus" NOT NULL,
    "changedByUserId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "PrintOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSplit" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printOrderId" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "platformAmount" INTEGER NOT NULL,
    "labAmount" INTEGER,
    "photographerAmount" INTEGER,
    "status" "PaymentSplitStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PaymentSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsDocument" (
    "id" SERIAL NOT NULL,
    "role" "Role" NOT NULL,
    "version" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "termsDocumentId" INTEGER NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedIp" TEXT,
    "acceptedUserAgent" TEXT,
    "documentHash" TEXT,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMessageThread" (
    "id" SERIAL NOT NULL,
    "participantUserId" INTEGER NOT NULL,
    "participantRole" "Role" NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminMessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMessage" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "senderId" INTEGER,
    "senderRole" "Role" NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumInterest" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastName" TEXT,
    "whatsapp" TEXT,
    "firstName" TEXT,
    "hasPurchased" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedAt" TIMESTAMP(3),
    "nextEmailAt" TIMESTAMP(3),
    "sentE01" BOOLEAN NOT NULL DEFAULT false,
    "sentE02" BOOLEAN NOT NULL DEFAULT false,
    "sentE03" BOOLEAN NOT NULL DEFAULT false,
    "sentE04" BOOLEAN NOT NULL DEFAULT false,
    "sentE05" BOOLEAN NOT NULL DEFAULT false,
    "sentE06" BOOLEAN NOT NULL DEFAULT false,
    "sentE07" BOOLEAN NOT NULL DEFAULT false,
    "sentE08" BOOLEAN NOT NULL DEFAULT false,
    "biometricConsent" BOOLEAN NOT NULL DEFAULT false,
    "biometricConsentAt" TIMESTAMP(3),
    "biometricDeletedAt" TIMESTAMP(3),
    "selfieKey" TEXT,
    "faceId" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AlbumInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceMatchEvent" (
    "id" SERIAL NOT NULL,
    "albumInterestId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "faceDetectionId" INTEGER,
    "similarity" DOUBLE PRECISION NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenAlbumAttempt" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "guestId" TEXT,
    "qrSessionId" TEXT,
    "ipHash" TEXT,
    "userAgent" VARCHAR(1024),
    "deviceType" "HiddenAlbumDeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "result" "HiddenAlbumAttemptResult" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" VARCHAR(512),
    "facesInSelfieCount" INTEGER NOT NULL DEFAULT 0,
    "bestMatchConfidence" DOUBLE PRECISION,
    "matchedFacesCount" INTEGER NOT NULL DEFAULT 0,
    "photosNoFaceCount" INTEGER NOT NULL DEFAULT 0,
    "photosMatchedCount" INTEGER NOT NULL DEFAULT 0,
    "photosVisibleTotal" INTEGER NOT NULL DEFAULT 0,
    "selfieStored" BOOLEAN NOT NULL DEFAULT false,
    "selfieObjectKey" TEXT,
    "selfieExpiresAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "HiddenAlbumAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenAlbumGrant" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,
    "guestId" TEXT,
    "attemptId" TEXT NOT NULL,
    "allowedPhotoIds" JSONB NOT NULL,
    "allowedCount" INTEGER NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HiddenAlbumGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" SERIAL NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "templateId" INTEGER,
    "templateData" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentEmailLog" (
    "id" SERIAL NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "resendId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "albumId" INTEGER,

    CONSTRAINT "SentEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSystemMessage" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSystemMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLoginDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDownloadToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "type" "DownloadTokenType" NOT NULL,
    "orderId" INTEGER,
    "photoId" INTEGER,
    "albumId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "OrderDownloadToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZipGenerationJob" (
    "id" TEXT NOT NULL,
    "type" "ZipJobType" NOT NULL,
    "status" "ZipJobStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" INTEGER,
    "albumId" INTEGER,
    "requesterUserId" INTEGER,
    "photoIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "r2Key" TEXT,
    "zipUrl" TEXT,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZipGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailPreferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "email" TEXT NOT NULL,
    "enableAlbumReady" BOOLEAN NOT NULL DEFAULT true,
    "enableReminders" BOOLEAN NOT NULL DEFAULT true,
    "enableOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "enablePromotions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralAttribution" (
    "id" SERIAL NOT NULL,
    "referralCodeId" INTEGER NOT NULL,
    "referrerUserId" INTEGER NOT NULL,
    "referredUserId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEarning" (
    "id" SERIAL NOT NULL,
    "attributionId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "saleRef" TEXT,
    "platformFeeCents" INTEGER NOT NULL,
    "referralAmountCents" INTEGER NOT NULL,
    "platformNetCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidOutAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "appliedToOrderId" INTEGER,
    "appliedToOrderType" TEXT,

    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPayoutRequest" (
    "id" SERIAL NOT NULL,
    "referrerUserId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" INTEGER,
    "externalRef" TEXT,
    "notes" TEXT,

    CONSTRAINT "ReferralPayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UncollectedPlatformFee" (
    "id" SERIAL NOT NULL,
    "orderType" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UncollectedPlatformFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" SERIAL NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "relationship" "PrivacyRequestRelationship" NOT NULL DEFAULT 'TITULAR',
    "description" TEXT,
    "albumId" INTEGER,
    "photoId" INTEGER,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "internalNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyEvent" (
    "id" SERIAL NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityProfile" (
    "id" TEXT NOT NULL,
    "type" "CommunityProfileType" NOT NULL,
    "status" "CommunityProfileStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "email" TEXT,
    "emailNormalized" TEXT,
    "whatsapp" TEXT,
    "whatsappNormalized" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "logoUrl" TEXT,
    "contactName" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityCategory" (
    "id" SERIAL NOT NULL,
    "type" "CommunityProfileType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CommunityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityProfileCategory" (
    "profileId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "CommunityProfileCategory_pkey" PRIMARY KEY ("profileId","categoryId")
);

-- CreateTable
CREATE TABLE "CommunityWorkReference" (
    "id" SERIAL NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityWorkReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySubmission" (
    "id" SERIAL NOT NULL,
    "type" "CommunityProfileType" NOT NULL,
    "status" "CommunitySubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "matchedProfileId" TEXT,
    "conflictProfileIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAuditLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" INTEGER,
    "actorRole" TEXT,
    "targetOrderType" TEXT NOT NULL,
    "targetOrderId" INTEGER NOT NULL,
    "targetAlbumId" INTEGER,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "riskScoreSnapshot" INTEGER,

    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT NOT NULL,
    "orderId" INTEGER,
    "orderType" TEXT,
    "status" TEXT,
    "externalRef" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT,
    "rawPayload" JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" INTEGER,
    "userId" INTEGER,
    "labId" INTEGER,
    "ruleCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "riskScore" INTEGER,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRestriction" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "userId" INTEGER,
    "labId" INTEGER,
    "restrictionType" TEXT NOT NULL,
    "reason" TEXT,
    "appliedBy" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "AccountRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankGlobalCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "FotorankGlobalCategoryReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "suggestedByUserId" INTEGER,
    "suggestionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankGlobalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankGlobalCategoryAlias" (
    "id" TEXT NOT NULL,
    "globalCategoryId" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankGlobalCategoryAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceFeatureModule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFeatureModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeWorkspaceBranding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "commercialName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeWorkspaceBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSalesWorkspaceSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "enrollmentCtaLabel" TEXT DEFAULT 'Quiero inscribirme',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesWorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSalesTeacher" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "shortBio" TEXT,
    "longBio" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "specialty" TEXT,
    "experienceYears" INTEGER,
    "city" TEXT,
    "country" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSalesCourse" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "modality" "CourseSalesModality" NOT NULL,
    "level" "CourseSalesLevel" NOT NULL,
    "category" TEXT,
    "targetAudience" TEXT,
    "prerequisites" TEXT,
    "objectives" TEXT,
    "durationText" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "scheduleText" TEXT,
    "seats" INTEGER,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "discountPrice" DECIMAL(12,2),
    "includesCertificate" BOOLEAN NOT NULL DEFAULT false,
    "includesRecordings" BOOLEAN NOT NULL DEFAULT false,
    "includesDownloadables" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CourseSalesCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "landingBlocksJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSalesSection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSalesLesson" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSalesLead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" "CourseSalesLeadStatus" NOT NULL DEFAULT 'NEW',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSalesLead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "eventLocation" TEXT,
    "message" TEXT,
    "status" "ServiceLeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceAppAccess" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "app" "SuiteApp" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "appRole" "SuiteAppRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAppAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" TEXT,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestOrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "FotorankOrganizationRole" NOT NULL,
    "status" "FotorankMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestOrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "coverImageUrl" TEXT,
    "prizesSummary" TEXT,
    "sponsorsText" TEXT,
    "status" "FotorankContestStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "FotorankContestVisibility" NOT NULL DEFAULT 'PUBLIC',
    "rulesText" TEXT,
    "rulesData" JSONB,
    "startAt" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3),
    "judgingStartAt" TIMESTAMP(3),
    "judgingEndAt" TIMESTAMP(3),
    "resultsAt" TIMESTAMP(3),
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestCategory" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "maxFiles" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "FotorankContestCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "sourceGlobalCategoryId" TEXT,
    "linkedPendingGlobalCategoryId" TEXT,
    "mappingIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestCategoryGlobalCategory" (
    "id" TEXT NOT NULL,
    "contestCategoryId" TEXT NOT NULL,
    "globalCategoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankContestCategoryGlobalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountStatus" "FotorankJudgeAccountStatus" NOT NULL DEFAULT 'INVITED',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeProfile" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "shortBio" TEXT,
    "fullBioRichJson" JSONB,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "otherLinksJson" JSONB,
    "publicSlug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "displayNameOverride" TEXT,
    "professionalHeadline" TEXT,
    "specialtiesJson" JSONB,
    "experienceYears" INTEGER,
    "languagesJson" JSONB,
    "region" TEXT,
    "portfolioUrl" TEXT,
    "isAvailableForJuryWork" BOOLEAN NOT NULL DEFAULT true,
    "availabilityNotes" TEXT,
    "availableRemote" BOOLEAN NOT NULL DEFAULT true,
    "availableInPerson" BOOLEAN NOT NULL DEFAULT false,
    "preferredContestScopes" TEXT,
    "compensationMode" "FotorankJudgeCompensationMode" NOT NULL DEFAULT 'VOLUNTEER',
    "pricingMode" "FotorankJudgePricingMode" NOT NULL DEFAULT 'NOT_SHOWN',
    "priceAmount" DOUBLE PRECISION,
    "priceCurrency" TEXT,
    "priceNotes" TEXT,
    "priceUnit" "FotorankJudgePriceUnit",
    "isListedInProfessionalDirectory" BOOLEAN NOT NULL DEFAULT false,
    "showPricingPublicly" BOOLEAN NOT NULL DEFAULT false,
    "showLocationPublicly" BOOLEAN NOT NULL DEFAULT true,
    "showWebsitePublicly" BOOLEAN NOT NULL DEFAULT true,
    "showInstagramPublicly" BOOLEAN NOT NULL DEFAULT true,
    "isVerifiedByPlatform" BOOLEAN NOT NULL DEFAULT false,
    "completedJuryAssignmentsCount" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION,
    "avgResponseTimeHours" DOUBLE PRECISION,
    "completionScore" DOUBLE PRECISION,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeOrganizationMembership" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipStatus" "FotorankJudgeMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeOrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "categoryId" TEXT,
    "judgeAccountId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitationStatus" "FotorankJudgeInvitationStatus" NOT NULL DEFAULT 'DRAFT',
    "sentByUserId" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeDirectoryInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "sentByUserId" INTEGER NOT NULL,
    "status" "FotorankJudgeDirectoryInviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "proposedRoleLabel" TEXT,
    "compensationOfferedText" TEXT,
    "organizerAcceptedExternalPaymentDisclaimer" BOOLEAN NOT NULL DEFAULT false,
    "categoryIdsJson" JSONB NOT NULL,
    "methodType" "FotorankJudgeMethodType" NOT NULL,
    "methodConfigJson" JSONB NOT NULL,
    "assignmentType" "FotorankJudgeAssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeDirectoryInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeAssignment" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assignmentType" "FotorankJudgeAssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "assignmentStatus" "FotorankJudgeAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "evaluationStartsAt" TIMESTAMP(3),
    "evaluationEndsAt" TIMESTAMP(3),
    "extendedEndsAt" TIMESTAMP(3),
    "extensionReason" TEXT,
    "methodType" "FotorankJudgeMethodType" NOT NULL,
    "methodConfigJson" JSONB NOT NULL,
    "allowVoteEdit" BOOLEAN NOT NULL DEFAULT true,
    "commentsVisibleToParticipants" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestEntry" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeVote" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "valueNumeric" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "isFavorite" BOOLEAN,
    "selectedRank" INTEGER,
    "criteriaScoresJson" JSONB,
    "comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeVoteHistory" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "previousPayloadJson" JSONB NOT NULL,
    "newPayloadJson" JSONB NOT NULL,
    "changedByJudgeId" TEXT,
    "changeReason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankJudgeVoteHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT,
    "actorType" "FotorankJudgeActorType" NOT NULL,
    "actorUserId" INTEGER,
    "actorJudgeId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankJudgeAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankDiplomaTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FotorankDiplomaTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "widthPt" DOUBLE PRECISION NOT NULL DEFAULT 842,
    "heightPt" DOUBLE PRECISION NOT NULL DEFAULT 595,
    "backgroundColor" TEXT NOT NULL DEFAULT '#0f0f0f',
    "backgroundImageUrl" TEXT,
    "layoutJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankDiplomaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankDiplomaIssued" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "recipientType" "FotorankDiplomaRecipientType" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientUserId" INTEGER,
    "entryId" TEXT,
    "judgeAccountId" TEXT,
    "contestCategoryId" TEXT,
    "prizeLabel" TEXT,
    "diplomaCode" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "verificationUrl" TEXT NOT NULL,
    "qrValue" TEXT NOT NULL,
    "status" "FotorankDiplomaIssuedStatus" NOT NULL DEFAULT 'ISSUED',
    "pdfUrl" TEXT,
    "pngUrl" TEXT,
    "pdfBytes" INTEGER,
    "pngBytes" INTEGER,
    "pdfChecksum" TEXT,
    "pngChecksum" TEXT,
    "renderedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "warningsJson" JSONB,
    "issuedByUserId" INTEGER NOT NULL,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankDiplomaIssued_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankAdminSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeSession" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankJudgeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handler_key" ON "User"("handler");

-- CreateIndex
CREATE UNIQUE INDEX "User_publicPageHandler_key" ON "User"("publicPageHandler");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");

-- CreateIndex
CREATE INDEX "EmailCampaign_createdAt_idx" ON "EmailCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "EmailSend_campaignId_idx" ON "EmailSend"("campaignId");

-- CreateIndex
CREATE INDEX "EmailSend_status_idx" ON "EmailSend"("status");

-- CreateIndex
CREATE INDEX "EmailSend_createdAt_idx" ON "EmailSend"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotographerSalesSettings_userId_key" ON "PhotographerSalesSettings"("userId");

-- CreateIndex
CREATE INDEX "PhotographerProduct_userId_idx" ON "PhotographerProduct"("userId");

-- CreateIndex
CREATE INDEX "PhotographerProduct_isActive_idx" ON "PhotographerProduct"("isActive");

-- CreateIndex
CREATE INDEX "PhotographerProduct_createdAt_idx" ON "PhotographerProduct"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Album_publicSlug_key" ON "Album"("publicSlug");

-- CreateIndex
CREATE INDEX "Album_userId_idx" ON "Album"("userId");

-- CreateIndex
CREATE INDEX "Album_creatorId_idx" ON "Album"("creatorId");

-- CreateIndex
CREATE INDEX "Album_eventId_idx" ON "Album"("eventId");

-- CreateIndex
CREATE INDEX "Album_schoolId_idx" ON "Album"("schoolId");

-- CreateIndex
CREATE INDEX "Album_geohash_idx" ON "Album"("geohash");

-- CreateIndex
CREATE INDEX "Album_coverPhotoId_idx" ON "Album"("coverPhotoId");

-- CreateIndex
CREATE INDEX "Album_selectedLabId_idx" ON "Album"("selectedLabId");

-- CreateIndex
CREATE INDEX "Album_isHidden_idx" ON "Album"("isHidden");

-- CreateIndex
CREATE INDEX "Album_deletedAt_idx" ON "Album"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumSalesSettings_albumId_key" ON "AlbumSalesSettings"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "UpsellStrategy_slug_key" ON "UpsellStrategy"("slug");

-- CreateIndex
CREATE INDEX "UserUpsellConfig_userId_idx" ON "UserUpsellConfig"("userId");

-- CreateIndex
CREATE INDEX "UserUpsellConfig_strategyId_idx" ON "UserUpsellConfig"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUpsellConfig_userId_strategyId_key" ON "UserUpsellConfig"("userId", "strategyId");

-- CreateIndex
CREATE INDEX "AlbumCollaborator_albumId_idx" ON "AlbumCollaborator"("albumId");

-- CreateIndex
CREATE INDEX "AlbumCollaborator_userId_idx" ON "AlbumCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumCollaborator_albumId_userId_key" ON "AlbumCollaborator"("albumId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumSlugAlias_aliasSlug_key" ON "AlbumSlugAlias"("aliasSlug");

-- CreateIndex
CREATE INDEX "AlbumSlugAlias_aliasSlug_idx" ON "AlbumSlugAlias"("aliasSlug");

-- CreateIndex
CREATE INDEX "AlbumSlugAlias_targetAlbumId_idx" ON "AlbumSlugAlias"("targetAlbumId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_shareSlug_key" ON "Event"("shareSlug");

-- CreateIndex
CREATE INDEX "Event_creatorId_idx" ON "Event"("creatorId");

-- CreateIndex
CREATE INDEX "Event_city_idx" ON "Event"("city");

-- CreateIndex
CREATE INDEX "Event_geohash_idx" ON "Event"("geohash");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_mergedIntoId_idx" ON "Event"("mergedIntoId");

-- CreateIndex
CREATE INDEX "Event_shareSlug_idx" ON "Event"("shareSlug");

-- CreateIndex
CREATE INDEX "Event_archivedAt_idx" ON "Event"("archivedAt");

-- CreateIndex
CREATE INDEX "EventMember_eventId_idx" ON "EventMember"("eventId");

-- CreateIndex
CREATE INDEX "EventMember_userId_idx" ON "EventMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventMember_eventId_userId_key" ON "EventMember"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventInvitation_eventId_idx" ON "EventInvitation"("eventId");

-- CreateIndex
CREATE INDEX "EventInvitation_userId_idx" ON "EventInvitation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_eventId_userId_key" ON "EventInvitation"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventSimilarity_status_idx" ON "EventSimilarity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventSimilarity_eventAId_eventBId_key" ON "EventSimilarity"("eventAId", "eventBId");

-- CreateIndex
CREATE INDEX "OrganizerDownloadAllowance_eventId_idx" ON "OrganizerDownloadAllowance"("eventId");

-- CreateIndex
CREATE INDEX "OrganizerDownloadAllowance_photographerId_idx" ON "OrganizerDownloadAllowance"("photographerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerDownloadAllowance_eventId_photographerId_key" ON "OrganizerDownloadAllowance"("eventId", "photographerId");

-- CreateIndex
CREATE INDEX "DashboardNotification_userId_idx" ON "DashboardNotification"("userId");

-- CreateIndex
CREATE INDEX "DashboardNotification_readAt_idx" ON "DashboardNotification"("readAt");

-- CreateIndex
CREATE INDEX "PhotobookDocument_createdAt_idx" ON "PhotobookDocument"("createdAt");

-- CreateIndex
CREATE INDEX "PhotobookDocument_updatedAt_idx" ON "PhotobookDocument"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumInvitation_tokenHash_key" ON "AlbumInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AlbumInvitation_albumId_idx" ON "AlbumInvitation"("albumId");

-- CreateIndex
CREATE INDEX "AlbumInvitation_invitedEmail_idx" ON "AlbumInvitation"("invitedEmail");

-- CreateIndex
CREATE INDEX "AlbumAccess_albumId_idx" ON "AlbumAccess"("albumId");

-- CreateIndex
CREATE INDEX "AlbumAccess_userId_idx" ON "AlbumAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumAccess_albumId_userId_key" ON "AlbumAccess"("albumId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE INDEX "School_ownerId_idx" ON "School"("ownerId");

-- CreateIndex
CREATE INDEX "SchoolCourse_schoolId_idx" ON "SchoolCourse"("schoolId");

-- CreateIndex
CREATE INDEX "Photo_albumId_idx" ON "Photo"("albumId");

-- CreateIndex
CREATE INDEX "Photo_userId_idx" ON "Photo"("userId");

-- CreateIndex
CREATE INDEX "Photo_isRemoved_idx" ON "Photo"("isRemoved");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAnalysisJob_photoId_key" ON "PhotoAnalysisJob"("photoId");

-- CreateIndex
CREATE INDEX "PhotoAnalysisJob_status_idx" ON "PhotoAnalysisJob"("status");

-- CreateIndex
CREATE INDEX "PhotoAnalysisJob_runAfter_idx" ON "PhotoAnalysisJob"("runAfter");

-- CreateIndex
CREATE INDEX "PhotoAnalysisJob_lockedAt_idx" ON "PhotoAnalysisJob"("lockedAt");

-- CreateIndex
CREATE INDEX "OcrToken_photoId_idx" ON "OcrToken"("photoId");

-- CreateIndex
CREATE INDEX "OcrToken_textNorm_idx" ON "OcrToken"("textNorm");

-- CreateIndex
CREATE UNIQUE INDEX "FaceDetection_rekognitionFaceId_key" ON "FaceDetection"("rekognitionFaceId");

-- CreateIndex
CREATE INDEX "FaceDetection_photoId_idx" ON "FaceDetection"("photoId");

-- CreateIndex
CREATE INDEX "Order_albumId_idx" ON "Order"("albumId");

-- CreateIndex
CREATE INDEX "Order_buyerUserId_idx" ON "Order"("buyerUserId");

-- CreateIndex
CREATE INDEX "Order_buyerEmail_idx" ON "Order"("buyerEmail");

-- CreateIndex
CREATE INDEX "AbandonedOrderReminder_orderId_idx" ON "AbandonedOrderReminder"("orderId");

-- CreateIndex
CREATE INDEX "AbandonedOrderReminder_createdAt_idx" ON "AbandonedOrderReminder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedOrderReminder_orderId_channel_key" ON "AbandonedOrderReminder"("orderId", "channel");

-- CreateIndex
CREATE INDEX "OrderFulfillmentGroup_orderId_idx" ON "OrderFulfillmentGroup"("orderId");

-- CreateIndex
CREATE INDEX "OrderFulfillmentGroup_photographerId_idx" ON "OrderFulfillmentGroup"("photographerId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_photoId_idx" ON "OrderItem"("photoId");

-- CreateIndex
CREATE INDEX "OrderItem_fulfillmentGroupId_idx" ON "OrderItem"("fulfillmentGroupId");

-- CreateIndex
CREATE INDEX "OrderItem_productType_idx" ON "OrderItem"("productType");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumProduct_defaultTemplateId_key" ON "AlbumProduct"("defaultTemplateId");

-- CreateIndex
CREATE INDEX "AlbumProduct_albumId_idx" ON "AlbumProduct"("albumId");

-- CreateIndex
CREATE INDEX "PreCompraOrder_albumId_idx" ON "PreCompraOrder"("albumId");

-- CreateIndex
CREATE INDEX "PreCompraOrder_buyerEmail_idx" ON "PreCompraOrder"("buyerEmail");

-- CreateIndex
CREATE INDEX "PreCompraOrder_buyerUserId_idx" ON "PreCompraOrder"("buyerUserId");

-- CreateIndex
CREATE INDEX "PreCompraOrder_schoolCourseId_idx" ON "PreCompraOrder"("schoolCourseId");

-- CreateIndex
CREATE INDEX "PreCompraOrderItem_orderId_idx" ON "PreCompraOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PreCompraOrderItem_albumProductId_idx" ON "PreCompraOrderItem"("albumProductId");

-- CreateIndex
CREATE INDEX "PreCompraOrderItem_subjectId_idx" ON "PreCompraOrderItem"("subjectId");

-- CreateIndex
CREATE INDEX "PreCompraOrderItem_status_idx" ON "PreCompraOrderItem"("status");

-- CreateIndex
CREATE INDEX "Subject_albumId_idx" ON "Subject"("albumId");

-- CreateIndex
CREATE INDEX "Subject_createdByOrderId_idx" ON "Subject"("createdByOrderId");

-- CreateIndex
CREATE INDEX "Subject_schoolCourseId_idx" ON "Subject"("schoolCourseId");

-- CreateIndex
CREATE INDEX "SubjectSelfie_subjectId_idx" ON "SubjectSelfie"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectSelfie_orderId_idx" ON "SubjectSelfie"("orderId");

-- CreateIndex
CREATE INDEX "PhotoFace_photoId_idx" ON "PhotoFace"("photoId");

-- CreateIndex
CREATE INDEX "FaceMatch_subjectId_idx" ON "FaceMatch"("subjectId");

-- CreateIndex
CREATE INDEX "FaceMatch_photoId_idx" ON "FaceMatch"("photoId");

-- CreateIndex
CREATE INDEX "FaceMatch_photoFaceId_idx" ON "FaceMatch"("photoFaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FaceMatch_subjectId_photoId_key" ON "FaceMatch"("subjectId", "photoId");

-- CreateIndex
CREATE INDEX "PhotoClaim_photoId_idx" ON "PhotoClaim"("photoId");

-- CreateIndex
CREATE INDEX "PhotoClaim_subjectId_idx" ON "PhotoClaim"("subjectId");

-- CreateIndex
CREATE INDEX "PhotoClaim_orderId_idx" ON "PhotoClaim"("orderId");

-- CreateIndex
CREATE INDEX "PhotoClaim_status_idx" ON "PhotoClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_orderItemId_key" ON "Selection"("orderItemId");

-- CreateIndex
CREATE INDEX "Selection_orderItemId_idx" ON "Selection"("orderItemId");

-- CreateIndex
CREATE INDEX "SelectionPhoto_selectionId_idx" ON "SelectionPhoto"("selectionId");

-- CreateIndex
CREATE INDEX "SelectionPhoto_photoId_idx" ON "SelectionPhoto"("photoId");

-- CreateIndex
CREATE INDEX "Template_albumId_idx" ON "Template"("albumId");

-- CreateIndex
CREATE INDEX "Template_albumProductId_idx" ON "Template"("albumProductId");

-- CreateIndex
CREATE INDEX "TemplateSlot_templateId_idx" ON "TemplateSlot"("templateId");

-- CreateIndex
CREATE INDEX "TemplateSlot_templateId_pageIndex_idx" ON "TemplateSlot"("templateId", "pageIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DesignProject_orderItemId_key" ON "DesignProject"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignProject_currentRevisionId_key" ON "DesignProject"("currentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignProject_approvedForExportRevisionId_key" ON "DesignProject"("approvedForExportRevisionId");

-- CreateIndex
CREATE INDEX "DesignProject_orderItemId_idx" ON "DesignProject"("orderItemId");

-- CreateIndex
CREATE INDEX "DesignProject_templateId_idx" ON "DesignProject"("templateId");

-- CreateIndex
CREATE INDEX "DesignProject_status_idx" ON "DesignProject"("status");

-- CreateIndex
CREATE INDEX "DesignProject_approvedByUserId_idx" ON "DesignProject"("approvedByUserId");

-- CreateIndex
CREATE INDEX "DesignProject_rejectedByUserId_idx" ON "DesignProject"("rejectedByUserId");

-- CreateIndex
CREATE INDEX "DesignRevision_designProjectId_idx" ON "DesignRevision"("designProjectId");

-- CreateIndex
CREATE INDEX "DesignPreviewJob_designRevisionId_idx" ON "DesignPreviewJob"("designRevisionId");

-- CreateIndex
CREATE INDEX "DesignPreviewJob_status_idx" ON "DesignPreviewJob"("status");

-- CreateIndex
CREATE INDEX "DesignPreviewJob_createdAt_idx" ON "DesignPreviewJob"("createdAt");

-- CreateIndex
CREATE INDEX "DesignExportJob_designProjectId_idx" ON "DesignExportJob"("designProjectId");

-- CreateIndex
CREATE INDEX "DesignExportJob_designRevisionId_idx" ON "DesignExportJob"("designRevisionId");

-- CreateIndex
CREATE INDEX "DesignExportJob_status_idx" ON "DesignExportJob"("status");

-- CreateIndex
CREATE INDEX "DesignExportJob_createdAt_idx" ON "DesignExportJob"("createdAt");

-- CreateIndex
CREATE INDEX "PrintOrder_labId_idx" ON "PrintOrder"("labId");

-- CreateIndex
CREATE INDEX "PrintOrder_photographerId_idx" ON "PrintOrder"("photographerId");

-- CreateIndex
CREATE INDEX "PrintOrder_clientId_idx" ON "PrintOrder"("clientId");

-- CreateIndex
CREATE INDEX "PrintOrder_status_idx" ON "PrintOrder"("status");

-- CreateIndex
CREATE INDEX "PrintOrder_paymentStatus_idx" ON "PrintOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "PrintOrder_orderType_idx" ON "PrintOrder"("orderType");

-- CreateIndex
CREATE INDEX "PrintOrder_createdAt_idx" ON "PrintOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PrintOrderItem_orderId_idx" ON "PrintOrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_email_key" ON "Lab"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_publicPageHandler_key" ON "Lab"("publicPageHandler");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_userId_key" ON "Lab"("userId");

-- CreateIndex
CREATE INDEX "Lab_approvalStatus_idx" ON "Lab"("approvalStatus");

-- CreateIndex
CREATE INDEX "Lab_userId_idx" ON "Lab"("userId");

-- CreateIndex
CREATE INDEX "Lab_labType_idx" ON "Lab"("labType");

-- CreateIndex
CREATE INDEX "Lab_soyFotografo_idx" ON "Lab"("soyFotografo");

-- CreateIndex
CREATE INDEX "Lab_province_city_idx" ON "Lab"("province", "city");

-- CreateIndex
CREATE INDEX "LabRecommendation_createdAt_idx" ON "LabRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX "LabBasePrice_labId_idx" ON "LabBasePrice"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "LabBasePrice_labId_size_key" ON "LabBasePrice"("labId", "size");

-- CreateIndex
CREATE INDEX "LabSizeDiscount_labId_idx" ON "LabSizeDiscount"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "LabSizeDiscount_labId_size_minQty_priceType_key" ON "LabSizeDiscount"("labId", "size", "minQty", "priceType");

-- CreateIndex
CREATE INDEX "LabProduct_labId_idx" ON "LabProduct"("labId");

-- CreateIndex
CREATE INDEX "LabProduct_isActive_idx" ON "LabProduct"("isActive");

-- CreateIndex
CREATE INDEX "LabProductVariant_labId_idx" ON "LabProductVariant"("labId");

-- CreateIndex
CREATE INDEX "LabProductVariant_isActive_idx" ON "LabProductVariant"("isActive");

-- CreateIndex
CREATE INDEX "LabProductVariant_category_idx" ON "LabProductVariant"("category");

-- CreateIndex
CREATE UNIQUE INDEX "LabProductVariant_labId_productName_size_finish_material_key" ON "LabProductVariant"("labId", "productName", "size", "finish", "material");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- CreateIndex
CREATE INDEX "SystemSettings_key_idx" ON "SystemSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_id_key" ON "AppConfig"("id");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryLog_orderId_idx" ON "WhatsAppDeliveryLog"("orderId");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryLog_status_idx" ON "WhatsAppDeliveryLog"("status");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryLog_createdAt_idx" ON "WhatsAppDeliveryLog"("createdAt");

-- CreateIndex
CREATE INDEX "AlbumNotification_albumId_idx" ON "AlbumNotification"("albumId");

-- CreateIndex
CREATE INDEX "AlbumNotification_email_idx" ON "AlbumNotification"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumNotification_albumId_email_key" ON "AlbumNotification"("albumId", "email");

-- CreateIndex
CREATE INDEX "AlbumExtension_albumId_idx" ON "AlbumExtension"("albumId");

-- CreateIndex
CREATE INDEX "AlbumExtension_requestedByUserId_idx" ON "AlbumExtension"("requestedByUserId");

-- CreateIndex
CREATE INDEX "AlbumExtension_createdAt_idx" ON "AlbumExtension"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoOAuthState_state_key" ON "MercadoPagoOAuthState"("state");

-- CreateIndex
CREATE INDEX "MercadoPagoOAuthState_ownerType_ownerId_idx" ON "MercadoPagoOAuthState"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "MercadoPagoOAuthState_expiresAt_idx" ON "MercadoPagoOAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "RemovalRequest_photographerId_idx" ON "RemovalRequest"("photographerId");

-- CreateIndex
CREATE INDEX "RemovalRequest_photoId_idx" ON "RemovalRequest"("photoId");

-- CreateIndex
CREATE INDEX "RemovalRequest_albumId_idx" ON "RemovalRequest"("albumId");

-- CreateIndex
CREATE INDEX "RemovalRequest_status_idx" ON "RemovalRequest"("status");

-- CreateIndex
CREATE INDEX "RemovalRequest_decidedByUserId_idx" ON "RemovalRequest"("decidedByUserId");

-- CreateIndex
CREATE INDEX "AdminLog_actorId_idx" ON "AdminLog"("actorId");

-- CreateIndex
CREATE INDEX "AdminLog_entity_entityId_idx" ON "AdminLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AdminLog_action_idx" ON "AdminLog"("action");

-- CreateIndex
CREATE INDEX "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_printOrderId_idx" ON "AdminLog"("printOrderId");

-- CreateIndex
CREATE INDEX "SupportTicket_printOrderId_idx" ON "SupportTicket"("printOrderId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "Testimonial_createdAt_idx" ON "Testimonial"("createdAt");

-- CreateIndex
CREATE INDEX "Testimonial_isApproved_idx" ON "Testimonial"("isApproved");

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_isRead_idx" ON "ContactMessage"("isRead");

-- CreateIndex
CREATE INDEX "ContactMessage_photographerId_idx" ON "ContactMessage"("photographerId");

-- CreateIndex
CREATE INDEX "ContactMessage_labId_idx" ON "ContactMessage"("labId");

-- CreateIndex
CREATE INDEX "PrintOrderStatusHistory_printOrderId_idx" ON "PrintOrderStatusHistory"("printOrderId");

-- CreateIndex
CREATE INDEX "PrintOrderStatusHistory_createdAt_idx" ON "PrintOrderStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "PrintOrderStatusHistory_changedByUserId_idx" ON "PrintOrderStatusHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

-- CreateIndex
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_authorId_idx" ON "SupportMessage"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSplit_printOrderId_key" ON "PaymentSplit"("printOrderId");

-- CreateIndex
CREATE INDEX "PaymentSplit_printOrderId_idx" ON "PaymentSplit"("printOrderId");

-- CreateIndex
CREATE INDEX "PaymentSplit_status_idx" ON "PaymentSplit"("status");

-- CreateIndex
CREATE INDEX "PaymentSplit_createdAt_idx" ON "PaymentSplit"("createdAt");

-- CreateIndex
CREATE INDEX "TermsDocument_role_isActive_idx" ON "TermsDocument"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TermsDocument_role_version_key" ON "TermsDocument"("role", "version");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_role_idx" ON "TermsAcceptance"("userId", "role");

-- CreateIndex
CREATE INDEX "TermsAcceptance_acceptedAt_idx" ON "TermsAcceptance"("acceptedAt");

-- CreateIndex
CREATE INDEX "TermsAcceptance_termsDocumentId_idx" ON "TermsAcceptance"("termsDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAcceptance_userId_role_termsVersion_key" ON "TermsAcceptance"("userId", "role", "termsVersion");

-- CreateIndex
CREATE INDEX "AdminMessageThread_participantUserId_idx" ON "AdminMessageThread"("participantUserId");

-- CreateIndex
CREATE INDEX "AdminMessageThread_lastMessageAt_idx" ON "AdminMessageThread"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMessageThread_participantUserId_participantRole_key" ON "AdminMessageThread"("participantUserId", "participantRole");

-- CreateIndex
CREATE INDEX "AdminMessage_threadId_idx" ON "AdminMessage"("threadId");

-- CreateIndex
CREATE INDEX "AdminMessage_createdAt_idx" ON "AdminMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_isRead_idx" ON "AdminMessage"("isRead");

-- CreateIndex
CREATE INDEX "AdminMessage_senderId_idx" ON "AdminMessage"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumInterest_selfieKey_key" ON "AlbumInterest"("selfieKey");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumInterest_faceId_key" ON "AlbumInterest"("faceId");

-- CreateIndex
CREATE INDEX "AlbumInterest_albumId_idx" ON "AlbumInterest"("albumId");

-- CreateIndex
CREATE INDEX "AlbumInterest_email_idx" ON "AlbumInterest"("email");

-- CreateIndex
CREATE INDEX "AlbumInterest_faceId_idx" ON "AlbumInterest"("faceId");

-- CreateIndex
CREATE INDEX "AlbumInterest_expiresAt_idx" ON "AlbumInterest"("expiresAt");

-- CreateIndex
CREATE INDEX "AlbumInterest_biometricDeletedAt_idx" ON "AlbumInterest"("biometricDeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumInterest_albumId_email_key" ON "AlbumInterest"("albumId", "email");

-- CreateIndex
CREATE INDEX "FaceMatchEvent_albumInterestId_idx" ON "FaceMatchEvent"("albumInterestId");

-- CreateIndex
CREATE INDEX "FaceMatchEvent_photoId_idx" ON "FaceMatchEvent"("photoId");

-- CreateIndex
CREATE INDEX "FaceMatchEvent_notifiedAt_idx" ON "FaceMatchEvent"("notifiedAt");

-- CreateIndex
CREATE INDEX "FaceMatchEvent_createdAt_idx" ON "FaceMatchEvent"("createdAt");

-- CreateIndex
CREATE INDEX "HiddenAlbumAttempt_albumId_idx" ON "HiddenAlbumAttempt"("albumId");

-- CreateIndex
CREATE INDEX "HiddenAlbumAttempt_createdAt_idx" ON "HiddenAlbumAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "HiddenAlbumAttempt_userId_idx" ON "HiddenAlbumAttempt"("userId");

-- CreateIndex
CREATE INDEX "HiddenAlbumAttempt_guestId_idx" ON "HiddenAlbumAttempt"("guestId");

-- CreateIndex
CREATE INDEX "HiddenAlbumAttempt_result_idx" ON "HiddenAlbumAttempt"("result");

-- CreateIndex
CREATE INDEX "HiddenAlbumAttempt_qrSessionId_idx" ON "HiddenAlbumAttempt"("qrSessionId");

-- CreateIndex
CREATE INDEX "HiddenAlbumGrant_albumId_idx" ON "HiddenAlbumGrant"("albumId");

-- CreateIndex
CREATE INDEX "HiddenAlbumGrant_expiresAt_idx" ON "HiddenAlbumGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "HiddenAlbumGrant_userId_idx" ON "HiddenAlbumGrant"("userId");

-- CreateIndex
CREATE INDEX "HiddenAlbumGrant_guestId_idx" ON "HiddenAlbumGrant"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenAlbumGrant_attemptId_key" ON "HiddenAlbumGrant"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailQueue_idempotencyKey_key" ON "EmailQueue"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailQueue_status_scheduledFor_idx" ON "EmailQueue"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "EmailQueue_idempotencyKey_idx" ON "EmailQueue"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailQueue_createdAt_idx" ON "EmailQueue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailTemplate_key_idx" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_purpose_idx" ON "EmailVerificationToken"("email", "purpose");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SentEmailLog_to_idx" ON "SentEmailLog"("to");

-- CreateIndex
CREATE INDEX "SentEmailLog_templateKey_idx" ON "SentEmailLog"("templateKey");

-- CreateIndex
CREATE INDEX "SentEmailLog_createdAt_idx" ON "SentEmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminSystemMessage_type_idx" ON "AdminSystemMessage"("type");

-- CreateIndex
CREATE INDEX "AdminSystemMessage_isRead_idx" ON "AdminSystemMessage"("isRead");

-- CreateIndex
CREATE INDEX "AdminSystemMessage_createdAt_idx" ON "AdminSystemMessage"("createdAt");

-- CreateIndex
CREATE INDEX "UserLoginDevice_userId_idx" ON "UserLoginDevice"("userId");

-- CreateIndex
CREATE INDEX "UserLoginDevice_lastSeenAt_idx" ON "UserLoginDevice"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserLoginDevice_userId_deviceHash_key" ON "UserLoginDevice"("userId", "deviceHash");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDownloadToken_token_key" ON "OrderDownloadToken"("token");

-- CreateIndex
CREATE INDEX "OrderDownloadToken_token_idx" ON "OrderDownloadToken"("token");

-- CreateIndex
CREATE INDEX "OrderDownloadToken_type_orderId_idx" ON "OrderDownloadToken"("type", "orderId");

-- CreateIndex
CREATE INDEX "OrderDownloadToken_expiresAt_idx" ON "OrderDownloadToken"("expiresAt");

-- CreateIndex
CREATE INDEX "OrderDownloadToken_albumId_idx" ON "OrderDownloadToken"("albumId");

-- CreateIndex
CREATE INDEX "ZipGenerationJob_status_createdAt_idx" ON "ZipGenerationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ZipGenerationJob_orderId_idx" ON "ZipGenerationJob"("orderId");

-- CreateIndex
CREATE INDEX "ZipGenerationJob_albumId_idx" ON "ZipGenerationJob"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailPreferences_email_key" ON "EmailPreferences"("email");

-- CreateIndex
CREATE INDEX "EmailPreferences_userId_idx" ON "EmailPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_ownerUserId_key" ON "ReferralCode"("ownerUserId");

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_ownerUserId_idx" ON "ReferralCode"("ownerUserId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referrerUserId_idx" ON "ReferralAttribution"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referralCodeId_idx" ON "ReferralAttribution"("referralCodeId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_status_endsAt_idx" ON "ReferralAttribution"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralEarning_attributionId_idx" ON "ReferralEarning"("attributionId");

-- CreateIndex
CREATE INDEX "ReferralEarning_createdAt_idx" ON "ReferralEarning"("createdAt");

-- CreateIndex
CREATE INDEX "ReferralPayoutRequest_referrerUserId_idx" ON "ReferralPayoutRequest"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralPayoutRequest_status_idx" ON "ReferralPayoutRequest"("status");

-- CreateIndex
CREATE INDEX "UncollectedPlatformFee_status_idx" ON "UncollectedPlatformFee"("status");

-- CreateIndex
CREATE INDEX "UncollectedPlatformFee_orderType_orderId_idx" ON "UncollectedPlatformFee"("orderType", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "UncollectedPlatformFee_orderType_orderId_key" ON "UncollectedPlatformFee"("orderType", "orderId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");

-- CreateIndex
CREATE INDEX "PrivacyRequest_type_idx" ON "PrivacyRequest"("type");

-- CreateIndex
CREATE INDEX "PrivacyRequest_createdAt_idx" ON "PrivacyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PrivacyEvent_eventType_idx" ON "PrivacyEvent"("eventType");

-- CreateIndex
CREATE INDEX "PrivacyEvent_userId_idx" ON "PrivacyEvent"("userId");

-- CreateIndex
CREATE INDEX "PrivacyEvent_createdAt_idx" ON "PrivacyEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityProfile_type_status_idx" ON "CommunityProfile"("type", "status");

-- CreateIndex
CREATE INDEX "CommunityProfile_type_province_idx" ON "CommunityProfile"("type", "province");

-- CreateIndex
CREATE INDEX "CommunityProfile_type_city_idx" ON "CommunityProfile"("type", "city");

-- CreateIndex
CREATE INDEX "CommunityProfile_province_city_idx" ON "CommunityProfile"("province", "city");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfile_type_slug_key" ON "CommunityProfile"("type", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfile_type_emailNormalized_key" ON "CommunityProfile"("type", "emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfile_type_whatsappNormalized_key" ON "CommunityProfile"("type", "whatsappNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityCategory_type_slug_key" ON "CommunityCategory"("type", "slug");

-- CreateIndex
CREATE INDEX "CommunityWorkReference_profileId_idx" ON "CommunityWorkReference"("profileId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_targetOrderType_targetOrderId_idx" ON "OrderAuditLog"("targetOrderType", "targetOrderId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_actorUserId_idx" ON "OrderAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_eventType_idx" ON "OrderAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_paymentId_key" ON "WebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_paymentId_idx" ON "WebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_orderId_orderType_idx" ON "WebhookEvent"("orderId", "orderType");

-- CreateIndex
CREATE INDEX "FraudAlert_userId_idx" ON "FraudAlert"("userId");

-- CreateIndex
CREATE INDEX "FraudAlert_labId_idx" ON "FraudAlert"("labId");

-- CreateIndex
CREATE INDEX "FraudAlert_ruleCode_idx" ON "FraudAlert"("ruleCode");

-- CreateIndex
CREATE INDEX "FraudAlert_status_idx" ON "FraudAlert"("status");

-- CreateIndex
CREATE INDEX "FraudAlert_createdAt_idx" ON "FraudAlert"("createdAt");

-- CreateIndex
CREATE INDEX "AccountRestriction_userId_idx" ON "AccountRestriction"("userId");

-- CreateIndex
CREATE INDEX "AccountRestriction_labId_idx" ON "AccountRestriction"("labId");

-- CreateIndex
CREATE INDEX "AccountRestriction_restrictionType_idx" ON "AccountRestriction"("restrictionType");

-- CreateIndex
CREATE INDEX "AccountRestriction_expiresAt_idx" ON "AccountRestriction"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankGlobalCategory_slug_key" ON "FotorankGlobalCategory"("slug");

-- CreateIndex
CREATE INDEX "FotorankGlobalCategory_reviewStatus_isActive_idx" ON "FotorankGlobalCategory"("reviewStatus", "isActive");

-- CreateIndex
CREATE INDEX "FotorankGlobalCategory_parentId_idx" ON "FotorankGlobalCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankGlobalCategoryAlias_normalizedAlias_key" ON "FotorankGlobalCategoryAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "FotorankGlobalCategoryAlias_globalCategoryId_idx" ON "FotorankGlobalCategoryAlias"("globalCategoryId");

-- CreateIndex
CREATE INDEX "WorkspaceFeatureModule_moduleKey_idx" ON "WorkspaceFeatureModule"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceFeatureModule_workspaceId_moduleKey_key" ON "WorkspaceFeatureModule"("workspaceId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWorkspaceBranding_workspaceId_key" ON "FotofficeWorkspaceBranding"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWorkspaceBranding_publicSlug_key" ON "FotofficeWorkspaceBranding"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSalesWorkspaceSettings_workspaceId_key" ON "CourseSalesWorkspaceSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "CourseSalesTeacher_workspaceId_idx" ON "CourseSalesTeacher"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSalesTeacher_workspaceId_slug_key" ON "CourseSalesTeacher"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "CourseSalesCourse_workspaceId_idx" ON "CourseSalesCourse"("workspaceId");

-- CreateIndex
CREATE INDEX "CourseSalesCourse_teacherId_idx" ON "CourseSalesCourse"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSalesCourse_workspaceId_slug_key" ON "CourseSalesCourse"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "CourseSalesSection_courseId_idx" ON "CourseSalesSection"("courseId");

-- CreateIndex
CREATE INDEX "CourseSalesLesson_sectionId_idx" ON "CourseSalesLesson"("sectionId");

-- CreateIndex
CREATE INDEX "CourseSalesLead_workspaceId_idx" ON "CourseSalesLead"("workspaceId");

-- CreateIndex
CREATE INDEX "CourseSalesLead_courseId_idx" ON "CourseSalesLead"("courseId");

-- CreateIndex
CREATE INDEX "ServiceSalesLead_workspaceId_idx" ON "ServiceSalesLead"("workspaceId");

-- CreateIndex
CREATE INDEX "ServiceSalesLead_status_idx" ON "ServiceSalesLead"("status");

-- CreateIndex
CREATE INDEX "ServiceSalesLead_eventType_idx" ON "ServiceSalesLead"("eventType");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_workspaceId_role_idx" ON "WorkspaceMembership"("workspaceId", "role");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_userId_idx" ON "WorkspaceMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_userId_workspaceId_key" ON "WorkspaceMembership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceAppAccess_workspaceId_app_enabled_idx" ON "WorkspaceAppAccess"("workspaceId", "app", "enabled");

-- CreateIndex
CREATE INDEX "WorkspaceAppAccess_userId_app_idx" ON "WorkspaceAppAccess"("userId", "app");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceAppAccess_userId_workspaceId_app_key" ON "WorkspaceAppAccess"("userId", "workspaceId", "app");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankProfile_userId_key" ON "FotorankProfile"("userId");

-- CreateIndex
CREATE INDEX "FotorankProfile_userId_idx" ON "FotorankProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestOrganization_slug_key" ON "ContestOrganization"("slug");

-- CreateIndex
CREATE INDEX "ContestOrganization_slug_idx" ON "ContestOrganization"("slug");

-- CreateIndex
CREATE INDEX "ContestOrganization_createdByUserId_idx" ON "ContestOrganization"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContestOrganizationMember_organizationId_idx" ON "ContestOrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "ContestOrganizationMember_userId_idx" ON "ContestOrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestOrganizationMember_organizationId_userId_key" ON "ContestOrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "FotorankContest_organizationId_idx" ON "FotorankContest"("organizationId");

-- CreateIndex
CREATE INDEX "FotorankContest_status_idx" ON "FotorankContest"("status");

-- CreateIndex
CREATE INDEX "FotorankContest_createdByUserId_idx" ON "FotorankContest"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContest_organizationId_slug_key" ON "FotorankContest"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "FotorankContestCategory_contestId_idx" ON "FotorankContestCategory"("contestId");

-- CreateIndex
CREATE INDEX "FotorankContestCategory_contestId_status_idx" ON "FotorankContestCategory"("contestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestCategory_contestId_slug_key" ON "FotorankContestCategory"("contestId", "slug");

-- CreateIndex
CREATE INDEX "FotorankContestCategoryGlobalCategory_globalCategoryId_idx" ON "FotorankContestCategoryGlobalCategory"("globalCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestCategoryGlobalCategory_contestCategoryId_glo_key" ON "FotorankContestCategoryGlobalCategory"("contestCategoryId", "globalCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeAccount_email_key" ON "FotorankJudgeAccount"("email");

-- CreateIndex
CREATE INDEX "FotorankJudgeAccount_workspaceId_idx" ON "FotorankJudgeAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "FotorankJudgeAccount_accountStatus_idx" ON "FotorankJudgeAccount"("accountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeProfile_judgeAccountId_key" ON "FotorankJudgeProfile"("judgeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeProfile_publicSlug_key" ON "FotorankJudgeProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "FotorankJudgeProfile_isPublic_idx" ON "FotorankJudgeProfile"("isPublic");

-- CreateIndex
CREATE INDEX "FotorankJudgeProfile_isListedInProfessionalDirectory_idx" ON "FotorankJudgeProfile"("isListedInProfessionalDirectory");

-- CreateIndex
CREATE INDEX "FotorankJudgeOrganizationMembership_organizationId_idx" ON "FotorankJudgeOrganizationMembership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeOrganizationMembership_judgeAccountId_organiza_key" ON "FotorankJudgeOrganizationMembership"("judgeAccountId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeInvitation_tokenHash_key" ON "FotorankJudgeInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "FotorankJudgeInvitation_organizationId_invitationStatus_idx" ON "FotorankJudgeInvitation"("organizationId", "invitationStatus");

-- CreateIndex
CREATE INDEX "FotorankJudgeInvitation_contestId_idx" ON "FotorankJudgeInvitation"("contestId");

-- CreateIndex
CREATE INDEX "FotorankJudgeInvitation_email_idx" ON "FotorankJudgeInvitation"("email");

-- CreateIndex
CREATE INDEX "FotorankJudgeDirectoryInvitation_organizationId_status_idx" ON "FotorankJudgeDirectoryInvitation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FotorankJudgeDirectoryInvitation_contestId_judgeAccountId_idx" ON "FotorankJudgeDirectoryInvitation"("contestId", "judgeAccountId");

-- CreateIndex
CREATE INDEX "FotorankJudgeDirectoryInvitation_judgeAccountId_status_idx" ON "FotorankJudgeDirectoryInvitation"("judgeAccountId", "status");

-- CreateIndex
CREATE INDEX "FotorankJudgeAssignment_contestId_categoryId_idx" ON "FotorankJudgeAssignment"("contestId", "categoryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeAssignment_judgeAccountId_assignmentStatus_idx" ON "FotorankJudgeAssignment"("judgeAccountId", "assignmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeAssignment_judgeAccountId_contestId_categoryId_key" ON "FotorankJudgeAssignment"("judgeAccountId", "contestId", "categoryId");

-- CreateIndex
CREATE INDEX "FotorankContestEntry_contestId_categoryId_idx" ON "FotorankContestEntry"("contestId", "categoryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVote_entryId_idx" ON "FotorankJudgeVote"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeVote_assignmentId_entryId_key" ON "FotorankJudgeVote"("assignmentId", "entryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVoteHistory_assignmentId_idx" ON "FotorankJudgeVoteHistory"("assignmentId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVoteHistory_entryId_idx" ON "FotorankJudgeVoteHistory"("entryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVoteHistory_changedAt_idx" ON "FotorankJudgeVoteHistory"("changedAt");

-- CreateIndex
CREATE INDEX "FotorankJudgeAuditEvent_organizationId_createdAt_idx" ON "FotorankJudgeAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FotorankJudgeAuditEvent_contestId_idx" ON "FotorankJudgeAuditEvent"("contestId");

-- CreateIndex
CREATE INDEX "FotorankJudgeAuditEvent_entityType_entityId_idx" ON "FotorankJudgeAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FotorankDiplomaTemplate_organizationId_contestId_idx" ON "FotorankDiplomaTemplate"("organizationId", "contestId");

-- CreateIndex
CREATE INDEX "FotorankDiplomaTemplate_contestId_status_idx" ON "FotorankDiplomaTemplate"("contestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankDiplomaIssued_diplomaCode_key" ON "FotorankDiplomaIssued"("diplomaCode");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankDiplomaIssued_verificationToken_key" ON "FotorankDiplomaIssued"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankDiplomaIssued_supersededById_key" ON "FotorankDiplomaIssued"("supersededById");

-- CreateIndex
CREATE INDEX "FotorankDiplomaIssued_organizationId_contestId_idx" ON "FotorankDiplomaIssued"("organizationId", "contestId");

-- CreateIndex
CREATE INDEX "FotorankDiplomaIssued_contestId_status_idx" ON "FotorankDiplomaIssued"("contestId", "status");

-- CreateIndex
CREATE INDEX "FotorankDiplomaIssued_templateId_idx" ON "FotorankDiplomaIssued"("templateId");

-- CreateIndex
CREATE INDEX "FotorankDiplomaIssued_verificationToken_idx" ON "FotorankDiplomaIssued"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankAdminSession_tokenHash_key" ON "FotorankAdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "FotorankAdminSession_userId_idx" ON "FotorankAdminSession"("userId");

-- CreateIndex
CREATE INDEX "FotorankAdminSession_expiresAt_idx" ON "FotorankAdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeSession_tokenHash_key" ON "FotorankJudgeSession"("tokenHash");

-- CreateIndex
CREATE INDEX "FotorankJudgeSession_judgeAccountId_idx" ON "FotorankJudgeSession"("judgeAccountId");

-- CreateIndex
CREATE INDEX "FotorankJudgeSession_expiresAt_idx" ON "FotorankJudgeSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_preferredLabId_fkey" FOREIGN KEY ("preferredLabId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotographerSalesSettings" ADD CONSTRAINT "PhotographerSalesSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotographerProduct" ADD CONSTRAINT "PhotographerProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_selectedLabId_fkey" FOREIGN KEY ("selectedLabId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumSalesSettings" ADD CONSTRAINT "AlbumSalesSettings_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpsellConfig" ADD CONSTRAINT "UserUpsellConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpsellConfig" ADD CONSTRAINT "UserUpsellConfig_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "UpsellStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumCollaborator" ADD CONSTRAINT "AlbumCollaborator_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumCollaborator" ADD CONSTRAINT "AlbumCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumSlugAlias" ADD CONSTRAINT "AlbumSlugAlias_targetAlbumId_fkey" FOREIGN KEY ("targetAlbumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSimilarity" ADD CONSTRAINT "EventSimilarity_eventAId_fkey" FOREIGN KEY ("eventAId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSimilarity" ADD CONSTRAINT "EventSimilarity_eventBId_fkey" FOREIGN KEY ("eventBId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerDownloadAllowance" ADD CONSTRAINT "OrganizerDownloadAllowance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerDownloadAllowance" ADD CONSTRAINT "OrganizerDownloadAllowance_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardNotification" ADD CONSTRAINT "DashboardNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumInvitation" ADD CONSTRAINT "AlbumInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumInvitation" ADD CONSTRAINT "AlbumInvitation_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumInvitation" ADD CONSTRAINT "AlbumInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumAccess" ADD CONSTRAINT "AlbumAccess_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumAccess" ADD CONSTRAINT "AlbumAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCourse" ADD CONSTRAINT "SchoolCourse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAnalysisJob" ADD CONSTRAINT "PhotoAnalysisJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrToken" ADD CONSTRAINT "OcrToken_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceDetection" ADD CONSTRAINT "FaceDetection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonedOrderReminder" ADD CONSTRAINT "AbandonedOrderReminder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFulfillmentGroup" ADD CONSTRAINT "OrderFulfillmentGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_fulfillmentGroupId_fkey" FOREIGN KEY ("fulfillmentGroupId") REFERENCES "OrderFulfillmentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumProduct" ADD CONSTRAINT "AlbumProduct_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumProduct" ADD CONSTRAINT "AlbumProduct_defaultTemplateId_fkey" FOREIGN KEY ("defaultTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCompraOrder" ADD CONSTRAINT "PreCompraOrder_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCompraOrder" ADD CONSTRAINT "PreCompraOrder_schoolCourseId_fkey" FOREIGN KEY ("schoolCourseId") REFERENCES "SchoolCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCompraOrderItem" ADD CONSTRAINT "PreCompraOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PreCompraOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCompraOrderItem" ADD CONSTRAINT "PreCompraOrderItem_albumProductId_fkey" FOREIGN KEY ("albumProductId") REFERENCES "AlbumProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCompraOrderItem" ADD CONSTRAINT "PreCompraOrderItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_createdByOrderId_fkey" FOREIGN KEY ("createdByOrderId") REFERENCES "PreCompraOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolCourseId_fkey" FOREIGN KEY ("schoolCourseId") REFERENCES "SchoolCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectSelfie" ADD CONSTRAINT "SubjectSelfie_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectSelfie" ADD CONSTRAINT "SubjectSelfie_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PreCompraOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoFace" ADD CONSTRAINT "PhotoFace_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceMatch" ADD CONSTRAINT "FaceMatch_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceMatch" ADD CONSTRAINT "FaceMatch_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceMatch" ADD CONSTRAINT "FaceMatch_photoFaceId_fkey" FOREIGN KEY ("photoFaceId") REFERENCES "PhotoFace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoClaim" ADD CONSTRAINT "PhotoClaim_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoClaim" ADD CONSTRAINT "PhotoClaim_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoClaim" ADD CONSTRAINT "PhotoClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PreCompraOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "PreCompraOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionPhoto" ADD CONSTRAINT "SelectionPhoto_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionPhoto" ADD CONSTRAINT "SelectionPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionPhoto" ADD CONSTRAINT "SelectionPhoto_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_albumProductId_fkey" FOREIGN KEY ("albumProductId") REFERENCES "AlbumProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSlot" ADD CONSTRAINT "TemplateSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "PreCompraOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "DesignRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_approvedForExportRevisionId_fkey" FOREIGN KEY ("approvedForExportRevisionId") REFERENCES "DesignRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_designProjectId_fkey" FOREIGN KEY ("designProjectId") REFERENCES "DesignProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignPreviewJob" ADD CONSTRAINT "DesignPreviewJob_designRevisionId_fkey" FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignExportJob" ADD CONSTRAINT "DesignExportJob_designProjectId_fkey" FOREIGN KEY ("designProjectId") REFERENCES "DesignProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignExportJob" ADD CONSTRAINT "DesignExportJob_designRevisionId_fkey" FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrderItem" ADD CONSTRAINT "PrintOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabBasePrice" ADD CONSTRAINT "LabBasePrice_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSizeDiscount" ADD CONSTRAINT "LabSizeDiscount_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabProduct" ADD CONSTRAINT "LabProduct_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabProductVariant" ADD CONSTRAINT "LabProductVariant_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppDeliveryLog" ADD CONSTRAINT "WhatsAppDeliveryLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumNotification" ADD CONSTRAINT "AlbumNotification_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumExtension" ADD CONSTRAINT "AlbumExtension_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumExtension" ADD CONSTRAINT "AlbumExtension_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovalRequest" ADD CONSTRAINT "RemovalRequest_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovalRequest" ADD CONSTRAINT "RemovalRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovalRequest" ADD CONSTRAINT "RemovalRequest_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovalRequest" ADD CONSTRAINT "RemovalRequest_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrderStatusHistory" ADD CONSTRAINT "PrintOrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrderStatusHistory" ADD CONSTRAINT "PrintOrderStatusHistory_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_termsDocumentId_fkey" FOREIGN KEY ("termsDocumentId") REFERENCES "TermsDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessageThread" ADD CONSTRAINT "AdminMessageThread_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AdminMessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumInterest" ADD CONSTRAINT "AlbumInterest_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceMatchEvent" ADD CONSTRAINT "FaceMatchEvent_albumInterestId_fkey" FOREIGN KEY ("albumInterestId") REFERENCES "AlbumInterest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceMatchEvent" ADD CONSTRAINT "FaceMatchEvent_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceMatchEvent" ADD CONSTRAINT "FaceMatchEvent_faceDetectionId_fkey" FOREIGN KEY ("faceDetectionId") REFERENCES "FaceDetection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenAlbumAttempt" ADD CONSTRAINT "HiddenAlbumAttempt_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenAlbumGrant" ADD CONSTRAINT "HiddenAlbumGrant_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenAlbumGrant" ADD CONSTRAINT "HiddenAlbumGrant_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "HiddenAlbumAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailQueue" ADD CONSTRAINT "EmailQueue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoginDevice" ADD CONSTRAINT "UserLoginDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ReferralAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayoutRequest" ADD CONSTRAINT "ReferralPayoutRequest_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayoutRequest" ADD CONSTRAINT "ReferralPayoutRequest_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityProfileCategory" ADD CONSTRAINT "CommunityProfileCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityProfileCategory" ADD CONSTRAINT "CommunityProfileCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommunityCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityWorkReference" ADD CONSTRAINT "CommunityWorkReference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankGlobalCategory" ADD CONSTRAINT "FotorankGlobalCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankGlobalCategory" ADD CONSTRAINT "FotorankGlobalCategory_suggestedByUserId_fkey" FOREIGN KEY ("suggestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankGlobalCategoryAlias" ADD CONSTRAINT "FotorankGlobalCategoryAlias_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFeatureModule" ADD CONSTRAINT "WorkspaceFeatureModule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWorkspaceBranding" ADD CONSTRAINT "FotofficeWorkspaceBranding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesWorkspaceSettings" ADD CONSTRAINT "CourseSalesWorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesTeacher" ADD CONSTRAINT "CourseSalesTeacher_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesCourse" ADD CONSTRAINT "CourseSalesCourse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesCourse" ADD CONSTRAINT "CourseSalesCourse_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "CourseSalesTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesSection" ADD CONSTRAINT "CourseSalesSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseSalesCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesLesson" ADD CONSTRAINT "CourseSalesLesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSalesSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesLead" ADD CONSTRAINT "CourseSalesLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSalesLead" ADD CONSTRAINT "CourseSalesLead_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseSalesCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSalesLead" ADD CONSTRAINT "ServiceSalesLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAppAccess" ADD CONSTRAINT "WorkspaceAppAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAppAccess" ADD CONSTRAINT "WorkspaceAppAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankProfile" ADD CONSTRAINT "FotorankProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganization" ADD CONSTRAINT "ContestOrganization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganizationMember" ADD CONSTRAINT "ContestOrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganizationMember" ADD CONSTRAINT "ContestOrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganizationMember" ADD CONSTRAINT "ContestOrganizationMember_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContest" ADD CONSTRAINT "FotorankContest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContest" ADD CONSTRAINT "FotorankContest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestCategory" ADD CONSTRAINT "FotorankContestCategory_sourceGlobalCategoryId_fkey" FOREIGN KEY ("sourceGlobalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestCategory" ADD CONSTRAINT "FotorankContestCategory_linkedPendingGlobalCategoryId_fkey" FOREIGN KEY ("linkedPendingGlobalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestCategory" ADD CONSTRAINT "FotorankContestCategory_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestCategoryGlobalCategory" ADD CONSTRAINT "FotorankContestCategoryGlobalCategory_contestCategoryId_fkey" FOREIGN KEY ("contestCategoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestCategoryGlobalCategory" ADD CONSTRAINT "FotorankContestCategoryGlobalCategory_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAccount" ADD CONSTRAINT "FotorankJudgeAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeProfile" ADD CONSTRAINT "FotorankJudgeProfile_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeOrganizationMembership" ADD CONSTRAINT "FotorankJudgeOrganizationMembership_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeOrganizationMembership" ADD CONSTRAINT "FotorankJudgeOrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVote" ADD CONSTRAINT "FotorankJudgeVote_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FotorankJudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVote" ADD CONSTRAINT "FotorankJudgeVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVoteHistory" ADD CONSTRAINT "FotorankJudgeVoteHistory_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "FotorankJudgeVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVoteHistory" ADD CONSTRAINT "FotorankJudgeVoteHistory_changedByJudgeId_fkey" FOREIGN KEY ("changedByJudgeId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_actorJudgeId_fkey" FOREIGN KEY ("actorJudgeId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaTemplate" ADD CONSTRAINT "FotorankDiplomaTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaTemplate" ADD CONSTRAINT "FotorankDiplomaTemplate_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaTemplate" ADD CONSTRAINT "FotorankDiplomaTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FotorankDiplomaTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_contestCategoryId_fkey" FOREIGN KEY ("contestCategoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "FotorankDiplomaIssued"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankAdminSession" ADD CONSTRAINT "FotorankAdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeSession" ADD CONSTRAINT "FotorankJudgeSession_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AlbumInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

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
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PHOTOGRAPHER', 'LAB', 'CUSTOMER', 'LAB_PHOTOGRAPHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PrintFinish" AS ENUM ('BRILLO', 'MATE');

-- CreateEnum
CREATE TYPE "PrintOrderStatus" AS ENUM ('CREATED', 'IN_PRODUCTION', 'READY', 'READY_TO_PICKUP', 'SHIPPED', 'DELIVERED', 'CANCELED', 'RETIRED');

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
CREATE TYPE "EmailQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'CREATE_ACCOUNT');

-- CreateEnum
CREATE TYPE "ZipJobType" AS ENUM ('ORDER_DOWNLOAD', 'ALBUM_DOWNLOAD', 'CUSTOM_PHOTOS');

-- CreateEnum
CREATE TYPE "ZipJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DownloadTokenType" AS ENUM ('CLIENT_DIGITAL', 'LAB_PRINT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PHOTOGRAPHER',
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
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "city" TEXT,
    "companyName" TEXT,
    "companyOwner" TEXT,
    "country" TEXT,
    "cuit" TEXT,
    "phone" TEXT,
    "province" TEXT,
    "enableAlbumsPage" BOOLEAN NOT NULL DEFAULT false,
    "enablePrintPage" BOOLEAN NOT NULL DEFAULT false,
    "tertiaryColor" TEXT,
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

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
    "albumProfitMarginPercent" DOUBLE PRECISION,
    "coverPhotoId" INTEGER,
    "digitalPhotoPriceCents" INTEGER,
    "pickupBy" "PickupBy",
    "selectedLabId" INTEGER,
    "enableDigitalPhotos" BOOLEAN NOT NULL DEFAULT true,
    "enablePrintedPhotos" BOOLEAN NOT NULL DEFAULT true,
    "includeDigitalWithPrint" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extensionSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "mpPaymentId" TEXT,
    "platformCommissionCents" INTEGER DEFAULT 0,
    "pricingSnapshot" JSONB,
    "digitalDeliveredAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "finish" "PrintFinish",
    "material" "ProductMaterial",
    "productType" "OrderItemType" NOT NULL DEFAULT 'DIGITAL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintOrder" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labId" INTEGER NOT NULL DEFAULT 1,
    "photographerId" INTEGER,
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublicPageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "publicPageHandler" TEXT,
    "secondaryColor" TEXT,
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

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "AlbumInterest_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Album_coverPhotoId_idx" ON "Album"("coverPhotoId");

-- CreateIndex
CREATE INDEX "Album_selectedLabId_idx" ON "Album"("selectedLabId");

-- CreateIndex
CREATE INDEX "Album_isHidden_idx" ON "Album"("isHidden");

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
CREATE INDEX "Photo_albumId_idx" ON "Photo"("albumId");

-- CreateIndex
CREATE INDEX "Photo_userId_idx" ON "Photo"("userId");

-- CreateIndex
CREATE INDEX "Photo_isRemoved_idx" ON "Photo"("isRemoved");

-- CreateIndex
CREATE INDEX "Order_albumId_idx" ON "Order"("albumId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_photoId_idx" ON "OrderItem"("photoId");

-- CreateIndex
CREATE INDEX "OrderItem_productType_idx" ON "OrderItem"("productType");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_photoId_productType_size_finish_material_key" ON "OrderItem"("orderId", "photoId", "productType", "size", "finish", "material");

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
CREATE INDEX "LabBasePrice_labId_idx" ON "LabBasePrice"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "LabBasePrice_labId_size_key" ON "LabBasePrice"("labId", "size");

-- CreateIndex
CREATE INDEX "LabSizeDiscount_labId_idx" ON "LabSizeDiscount"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "LabSizeDiscount_labId_size_minQty_key" ON "LabSizeDiscount"("labId", "size", "minQty");

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
CREATE INDEX "AlbumInterest_albumId_idx" ON "AlbumInterest"("albumId");

-- CreateIndex
CREATE INDEX "AlbumInterest_email_idx" ON "AlbumInterest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumInterest_albumId_email_key" ON "AlbumInterest"("albumId", "email");

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

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_preferredLabId_fkey" FOREIGN KEY ("preferredLabId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotographerProduct" ADD CONSTRAINT "PhotographerProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_selectedLabId_fkey" FOREIGN KEY ("selectedLabId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "EmailQueue" ADD CONSTRAINT "EmailQueue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoginDevice" ADD CONSTRAINT "UserLoginDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


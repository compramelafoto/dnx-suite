-- Muestras Fotográficas · Etapa 8: venta de obras con reparto en tres y ediciones certificadas.
-- Aditiva: crea nueve tablas nuevas. No agrega columnas a tablas existentes ni toca filas.
-- Sin enums. Ids de usuario INTEGER sin FK a "User". `activityWorkId` sin FK (como etapas 6 y 7).
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank/Muestras (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de las
-- `20261101120000_*` y ANTES de publicar el código, y la registra en `_prisma_migrations` con el
-- SHA-256 de este archivo.

-- CreateTable
CREATE TABLE "CulturalSaleSetup" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "organizerUserId" INTEGER NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "organizerBps" INTEGER NOT NULL,
    "photographerBps" INTEGER NOT NULL,
    "splitVersion" INTEGER NOT NULL DEFAULT 1,
    "pickupText" TEXT,
    "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingCostArs" INTEGER,
    "shippingText" TEXT,
    "extraTerms" TEXT,
    "openedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalSaleSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleAuthorTerms" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "splitVersion" INTEGER NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "organizerBps" INTEGER NOT NULL,
    "photographerBps" INTEGER NOT NULL,
    "textVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalSaleAuthorTerms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalPayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "environment" TEXT NOT NULL,
    "mpEmail" TEXT NOT NULL,
    "receiverId" TEXT,
    "consentStatus" TEXT NOT NULL DEFAULT 'NONE',
    "inviteUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleFile" (
    "id" TEXT NOT NULL,
    "activityWorkId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT,
    "bytes" INTEGER,
    "mime" TEXT,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
    "problem" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalSaleFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalAuthorSignature" (
    "userId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalAuthorSignature_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CulturalWorkOffer" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityWorkId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "editionKind" TEXT NOT NULL,
    "editionSize" INTEGER NOT NULL,
    "proofCount" INTEGER NOT NULL DEFAULT 0,
    "priceArs" INTEGER NOT NULL,
    "approvedPriceArs" INTEGER,
    "paper" TEXT,
    "widthCm" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "proposedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" INTEGER,
    "firstSoldAt" TIMESTAMP(3),
    "editionGroupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalWorkOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalEditionCopy" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reservedUntil" TIMESTAMP(3),
    "orderId" TEXT,
    "certificateCode" TEXT,
    "certificateKid" TEXT,
    "certificatePayload" TEXT,
    "certificateSignature" TEXT,
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalEditionCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleOrder" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "copyId" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "buyerOnCertificate" BOOLEAN NOT NULL DEFAULT false,
    "delivery" TEXT NOT NULL,
    "shippingAddress" JSONB,
    "priceArs" INTEGER NOT NULL,
    "shippingArs" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "platformCents" INTEGER NOT NULL,
    "organizerCents" INTEGER NOT NULL,
    "photographerCents" INTEGER NOT NULL,
    "splitSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfillment" TEXT NOT NULL DEFAULT 'NONE',
    "trackingText" TEXT,
    "externalReference" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerStatus" TEXT,
    "providerStatusDetail" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "refundRequestedAt" TIMESTAMP(3),
    "regretRequestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalSaleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "providerStatus" TEXT,
    "detail" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalSaleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalSaleSetup_activityId_key" ON "CulturalSaleSetup"("activityId");
CREATE UNIQUE INDEX "CulturalSaleAuthorTerms_activityId_userId_key" ON "CulturalSaleAuthorTerms"("activityId", "userId");
CREATE INDEX "CulturalSaleAuthorTerms_userId_idx" ON "CulturalSaleAuthorTerms"("userId");
CREATE UNIQUE INDEX "CulturalPayoutAccount_userId_environment_key" ON "CulturalPayoutAccount"("userId", "environment");
CREATE INDEX "CulturalPayoutAccount_receiverId_idx" ON "CulturalPayoutAccount"("receiverId");
CREATE UNIQUE INDEX "CulturalSaleFile_activityWorkId_key" ON "CulturalSaleFile"("activityWorkId");
CREATE INDEX "CulturalSaleFile_activityId_idx" ON "CulturalSaleFile"("activityId");
CREATE INDEX "CulturalSaleFile_authorUserId_idx" ON "CulturalSaleFile"("authorUserId");
CREATE INDEX "CulturalWorkOffer_activityId_status_idx" ON "CulturalWorkOffer"("activityId", "status");
CREATE INDEX "CulturalWorkOffer_activityWorkId_idx" ON "CulturalWorkOffer"("activityWorkId");
CREATE INDEX "CulturalWorkOffer_authorUserId_idx" ON "CulturalWorkOffer"("authorUserId");
CREATE UNIQUE INDEX "CulturalEditionCopy_certificateCode_key" ON "CulturalEditionCopy"("certificateCode");
CREATE UNIQUE INDEX "CulturalEditionCopy_offerId_isTest_kind_number_key" ON "CulturalEditionCopy"("offerId", "isTest", "kind", "number");
CREATE INDEX "CulturalEditionCopy_activityId_idx" ON "CulturalEditionCopy"("activityId");
CREATE INDEX "CulturalEditionCopy_orderId_idx" ON "CulturalEditionCopy"("orderId");
CREATE UNIQUE INDEX "CulturalSaleOrder_publicId_key" ON "CulturalSaleOrder"("publicId");
CREATE UNIQUE INDEX "CulturalSaleOrder_copyId_key" ON "CulturalSaleOrder"("copyId");
CREATE UNIQUE INDEX "CulturalSaleOrder_externalReference_key" ON "CulturalSaleOrder"("externalReference");
CREATE UNIQUE INDEX "CulturalSaleOrder_providerOrderId_key" ON "CulturalSaleOrder"("providerOrderId");
CREATE UNIQUE INDEX "CulturalSaleOrder_idempotencyKey_key" ON "CulturalSaleOrder"("idempotencyKey");
CREATE INDEX "CulturalSaleOrder_activityId_status_idx" ON "CulturalSaleOrder"("activityId", "status");
CREATE INDEX "CulturalSaleOrder_offerId_idx" ON "CulturalSaleOrder"("offerId");
CREATE INDEX "CulturalSaleOrder_status_holdExpiresAt_idx" ON "CulturalSaleOrder"("status", "holdExpiresAt");
CREATE INDEX "CulturalSaleEvent_orderId_createdAt_idx" ON "CulturalSaleEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "CulturalSaleSetup" ADD CONSTRAINT "CulturalSaleSetup_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleAuthorTerms" ADD CONSTRAINT "CulturalSaleAuthorTerms_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleFile" ADD CONSTRAINT "CulturalSaleFile_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalWorkOffer" ADD CONSTRAINT "CulturalWorkOffer_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalEditionCopy" ADD CONSTRAINT "CulturalEditionCopy_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CulturalWorkOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalEditionCopy" ADD CONSTRAINT "CulturalEditionCopy_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleOrder" ADD CONSTRAINT "CulturalSaleOrder_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleOrder" ADD CONSTRAINT "CulturalSaleOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CulturalWorkOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleEvent" ADD CONSTRAINT "CulturalSaleEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CulturalSaleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

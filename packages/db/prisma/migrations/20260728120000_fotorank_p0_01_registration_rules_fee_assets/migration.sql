-- P0-01 FotoRank: inscripción nativa, bases versionadas, fee BPS, assets privados.
-- Rollback documentado en docs/fotorank/fotorank-p0-01-registration-implementation-report.md
-- No aplica en producción desde este cambio; solo local/staging explícito.

-- Extender modalidad de precio
ALTER TYPE "FotorankRegistrationPricingMode" ADD VALUE 'INVITATION_ONLY';

-- Enums nuevos
CREATE TYPE "FotorankContestRegistrationStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'DISQUALIFIED');
CREATE TYPE "FotorankContestRegistrationPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "FotorankFeeSource" AS ENUM ('NONE', 'ORGANIZER_DEFAULT', 'CONTEST_OVERRIDE');
CREATE TYPE "FotorankRulesVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "FotorankEntryAssetKind" AS ENUM ('ORIGINAL', 'DERIVATIVE_WEB', 'THUMBNAIL', 'JUDGE_VIEW', 'PUBLIC');

-- Fee organizador
ALTER TABLE "ContestOrganization"
ADD COLUMN "platformFeeBps" INTEGER;

-- Ventanas / fee / cancelación por concurso
ALTER TABLE "FotorankContest"
ADD COLUMN "platformFeeBps" INTEGER,
ADD COLUMN "submissionOpensAt" TIMESTAMP(3),
ADD COLUMN "timezone" TEXT,
ADD COLUMN "allowRegistrationCancellation" BOOLEAN NOT NULL DEFAULT true;

-- Bases versionadas
CREATE TABLE "FotorankContestRulesVersion" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "FotorankRulesVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestRulesVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankContestRulesVersion_contestId_versionNumber_key" ON "FotorankContestRulesVersion"("contestId", "versionNumber");
CREATE INDEX "FotorankContestRulesVersion_contestId_status_idx" ON "FotorankContestRulesVersion"("contestId", "status");
CREATE INDEX "FotorankContestRulesVersion_contentHash_idx" ON "FotorankContestRulesVersion"("contentHash");
CREATE INDEX "FotorankContestRulesVersion_createdByUserId_idx" ON "FotorankContestRulesVersion"("createdByUserId");

ALTER TABLE "FotorankContestRulesVersion" ADD CONSTRAINT "FotorankContestRulesVersion_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankContestRulesVersion" ADD CONSTRAINT "FotorankContestRulesVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inscripción nativa
CREATE TABLE "FotorankContestRegistration" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "participantUserId" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" "FotorankContestRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "FotorankContestRegistrationPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "registrationNumber" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rulesVersionId" TEXT NOT NULL,
    "rulesAcceptedAt" TIMESTAMP(3) NOT NULL,
    "rulesAcceptanceIp" TEXT,
    "rulesAcceptanceUserAgent" TEXT,
    "paymentModeSnapshot" "FotorankRegistrationPricingMode" NOT NULL,
    "registrationPriceSnapshot" INTEGER NOT NULL DEFAULT 0,
    "currencySnapshot" TEXT NOT NULL DEFAULT 'ARS',
    "platformFeeBpsSnapshot" INTEGER NOT NULL DEFAULT 0,
    "organizerNetBpsSnapshot" INTEGER NOT NULL DEFAULT 10000,
    "feeSourceSnapshot" "FotorankFeeSource" NOT NULL DEFAULT 'NONE',
    "financialPolicySnapshot" JSONB,
    "paymentOrderId" TEXT,
    "categoryLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankContestRegistration_contestId_participantUserId_key" ON "FotorankContestRegistration"("contestId", "participantUserId");
CREATE UNIQUE INDEX "FotorankContestRegistration_contestId_registrationNumber_key" ON "FotorankContestRegistration"("contestId", "registrationNumber");
CREATE INDEX "FotorankContestRegistration_contestId_status_idx" ON "FotorankContestRegistration"("contestId", "status");
CREATE INDEX "FotorankContestRegistration_participantUserId_idx" ON "FotorankContestRegistration"("participantUserId");
CREATE INDEX "FotorankContestRegistration_categoryId_idx" ON "FotorankContestRegistration"("categoryId");
CREATE INDEX "FotorankContestRegistration_rulesVersionId_idx" ON "FotorankContestRegistration"("rulesVersionId");
CREATE INDEX "FotorankContestRegistration_paymentOrderId_idx" ON "FotorankContestRegistration"("paymentOrderId");
CREATE INDEX "FotorankContestRegistration_paymentStatus_idx" ON "FotorankContestRegistration"("paymentStatus");

ALTER TABLE "FotorankContestRegistration" ADD CONSTRAINT "FotorankContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FotorankContestRegistration" ADD CONSTRAINT "FotorankContestRegistration_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FotorankContestRegistration" ADD CONSTRAINT "FotorankContestRegistration_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FotorankContestRegistration" ADD CONSTRAINT "FotorankContestRegistration_rulesVersionId_fkey" FOREIGN KEY ("rulesVersionId") REFERENCES "FotorankContestRulesVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Assets privados (estructura; sin upload UI en P0-01)
CREATE TABLE "FotorankContestEntryAsset" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "registrationId" TEXT,
    "entryId" TEXT,
    "kind" "FotorankEntryAssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestEntryAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankContestEntryAsset_entryId_kind_key" ON "FotorankContestEntryAsset"("entryId", "kind");
CREATE INDEX "FotorankContestEntryAsset_contestId_idx" ON "FotorankContestEntryAsset"("contestId");
CREATE INDEX "FotorankContestEntryAsset_registrationId_idx" ON "FotorankContestEntryAsset"("registrationId");
CREATE INDEX "FotorankContestEntryAsset_storageKey_idx" ON "FotorankContestEntryAsset"("storageKey");
CREATE INDEX "FotorankContestEntryAsset_sha256_idx" ON "FotorankContestEntryAsset"("sha256");

ALTER TABLE "FotorankContestEntryAsset" ADD CONSTRAINT "FotorankContestEntryAsset_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankContestEntryAsset" ADD CONSTRAINT "FotorankContestEntryAsset_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "FotorankContestRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankContestEntryAsset" ADD CONSTRAINT "FotorankContestEntryAsset_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

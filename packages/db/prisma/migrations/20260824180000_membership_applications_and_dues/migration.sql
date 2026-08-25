-- CreateEnum
CREATE TYPE "MemberFeeScale" AS ENUM ('PLENA', 'REDUCIDA', 'EXENTA');
CREATE TYPE "MemberLeftReason" AS ENUM ('DEUDA', 'SANCION', 'RENUNCIA');
CREATE TYPE "MembershipApplicationStatus" AS ENUM ('PENDIENTE', 'RECHAZADA', 'APROBADA_IMPAGA', 'VENCIDA', 'COMPLETADA');
CREATE TYPE "MembershipChargeConcept" AS ENUM ('INGRESO', 'MENSUAL', 'EXTRAORDINARIA', 'OTRO');
CREATE TYPE "MembershipPaymentStatus" AS ENUM ('PENDIENTE', 'ACREDITADO', 'RECHAZADO', 'DEVUELTO');

-- AlterTable
ALTER TABLE "MemberCategory"
  ADD COLUMN "grantsVote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "eligibleForBoard" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "generatesDues" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Member"
  ADD COLUMN "feeScale" "MemberFeeScale" NOT NULL DEFAULT 'PLENA',
  ADD COLUMN "ownDuesAmount" DECIMAL(12,2),
  ADD COLUMN "leftReason" "MemberLeftReason",
  ADD COLUMN "originInstitution" TEXT;

-- CreateTable
CREATE TABLE "MembershipApplication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "taxId" TEXT,
    "birthDate" TIMESTAMP(3),
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "noticeAddress" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "categoryId" TEXT,
    "declaredFeeScale" "MemberFeeScale" NOT NULL DEFAULT 'PLENA',
    "ownDuesAmount" DECIMAL(12,2),
    "originInstitution" TEXT,
    "avatarUrl" TEXT,
    "presenterMemberId" TEXT,
    "status" "MembershipApplicationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "rejectionReason" TEXT,
    "resolvedByUserId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "memberId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipDuesSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "generationDay" INTEGER NOT NULL DEFAULT 1,
    "dueDay" INTEGER NOT NULL DEFAULT 10,
    "graceDays" INTEGER NOT NULL DEFAULT 5,
    "initialDuesCount" INTEGER NOT NULL DEFAULT 3,
    "countJoinMonthIfBeforeDueDay" BOOLEAN NOT NULL DEFAULT true,
    "reminderDay" INTEGER NOT NULL DEFAULT 5,
    "collaboratorFloorMultiple" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "monthlyInterestRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "consecutiveUnpaidThreshold" INTEGER NOT NULL DEFAULT 3,
    "alternateUnpaidThreshold" INTEGER NOT NULL DEFAULT 5,
    "alternateWindowMonths" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipDuesSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipFeeValue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "boardMinutesRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipFeeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipCharge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "concept" "MembershipChargeConcept" NOT NULL DEFAULT 'MENSUAL',
    "period" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "balanceArs" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "feeValueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "platformFeeArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmountArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "MembershipPaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "method" TEXT,
    "providerPaymentRef" TEXT,
    "providerOrderRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "principalArs" DECIMAL(12,2) NOT NULL,
    "interestArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembershipAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_memberId_key" ON "MembershipApplication"("memberId");
CREATE INDEX "MembershipApplication_workspaceId_status_idx" ON "MembershipApplication"("workspaceId", "status");
CREATE INDEX "MembershipApplication_workspaceId_email_idx" ON "MembershipApplication"("workspaceId", "email");
CREATE INDEX "MembershipApplication_workspaceId_createdAt_idx" ON "MembershipApplication"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "MembershipDuesSettings_workspaceId_key" ON "MembershipDuesSettings"("workspaceId");
CREATE INDEX "MembershipFeeValue_workspaceId_validFrom_idx" ON "MembershipFeeValue"("workspaceId", "validFrom");
CREATE INDEX "MembershipFeeValue_workspaceId_categoryId_idx" ON "MembershipFeeValue"("workspaceId", "categoryId");
CREATE UNIQUE INDEX "MembershipCharge_memberId_concept_period_key" ON "MembershipCharge"("memberId", "concept", "period");
CREATE INDEX "MembershipCharge_workspaceId_dueDate_idx" ON "MembershipCharge"("workspaceId", "dueDate");
CREATE INDEX "MembershipCharge_memberId_dueDate_idx" ON "MembershipCharge"("memberId", "dueDate");
CREATE UNIQUE INDEX "MembershipPayment_providerPaymentRef_key" ON "MembershipPayment"("providerPaymentRef");
CREATE INDEX "MembershipPayment_workspaceId_status_idx" ON "MembershipPayment"("workspaceId", "status");
CREATE INDEX "MembershipPayment_memberId_createdAt_idx" ON "MembershipPayment"("memberId", "createdAt");
CREATE UNIQUE INDEX "MembershipAllocation_paymentId_chargeId_key" ON "MembershipAllocation"("paymentId", "chargeId");
CREATE INDEX "MembershipAllocation_chargeId_idx" ON "MembershipAllocation"("chargeId");

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipDuesSettings" ADD CONSTRAINT "MembershipDuesSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipFeeValue" ADD CONSTRAINT "MembershipFeeValue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipFeeValue" ADD CONSTRAINT "MembershipFeeValue_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MemberCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipCharge" ADD CONSTRAINT "MembershipCharge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCharge" ADD CONSTRAINT "MembershipCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipCharge" ADD CONSTRAINT "MembershipCharge_feeValueId_fkey" FOREIGN KEY ("feeValueId") REFERENCES "MembershipFeeValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipAllocation" ADD CONSTRAINT "MembershipAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipAllocation" ADD CONSTRAINT "MembershipAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "MembershipCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FotoRank: plantillas y diplomas emitidos (PDF/PNG, verificación, reemisión)

CREATE TYPE "FotorankDiplomaTemplateStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "FotorankDiplomaRecipientType" AS ENUM ('PARTICIPANT', 'ENTRY', 'JUDGE', 'COLLABORATOR');
CREATE TYPE "FotorankDiplomaIssuedStatus" AS ENUM ('ISSUED', 'FAILED', 'REVOKED', 'REPLACED');

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
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankDiplomaTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotorankDiplomaTemplate_organizationId_contestId_idx" ON "FotorankDiplomaTemplate"("organizationId", "contestId");
CREATE INDEX "FotorankDiplomaTemplate_contestId_status_idx" ON "FotorankDiplomaTemplate"("contestId", "status");

ALTER TABLE "FotorankDiplomaTemplate" ADD CONSTRAINT "FotorankDiplomaTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaTemplate" ADD CONSTRAINT "FotorankDiplomaTemplate_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaTemplate" ADD CONSTRAINT "FotorankDiplomaTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
    "issuedByUserId" TEXT NOT NULL,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankDiplomaIssued_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankDiplomaIssued_diplomaCode_key" ON "FotorankDiplomaIssued"("diplomaCode");
CREATE UNIQUE INDEX "FotorankDiplomaIssued_verificationToken_key" ON "FotorankDiplomaIssued"("verificationToken");
CREATE UNIQUE INDEX "FotorankDiplomaIssued_supersededById_key" ON "FotorankDiplomaIssued"("supersededById");
CREATE INDEX "FotorankDiplomaIssued_organizationId_contestId_idx" ON "FotorankDiplomaIssued"("organizationId", "contestId");
CREATE INDEX "FotorankDiplomaIssued_contestId_status_idx" ON "FotorankDiplomaIssued"("contestId", "status");
CREATE INDEX "FotorankDiplomaIssued_templateId_idx" ON "FotorankDiplomaIssued"("templateId");
CREATE INDEX "FotorankDiplomaIssued_verificationToken_idx" ON "FotorankDiplomaIssued"("verificationToken");

ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FotorankDiplomaTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_contestCategoryId_fkey" FOREIGN KEY ("contestCategoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FotorankDiplomaIssued" ADD CONSTRAINT "FotorankDiplomaIssued_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "FotorankDiplomaIssued"("id") ON DELETE SET NULL ON UPDATE CASCADE;

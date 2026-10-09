-- Muestras Fotográficas · Etapa 3: convocatoria online y curaduría anónima.
-- Aditiva: crea cinco tablas nuevas (CulturalCall, CulturalCallSubmission, CulturalCallWork,
-- CulturalCallCurator, CulturalCallScore). No toca tablas ni filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`) y la registra en
-- `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código.

-- CreateTable
CREATE TABLE "CulturalCall" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "basesText" TEXT NOT NULL,
    "requirementsText" TEXT,
    "rightsText" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "maxWorksPerPerson" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "curationStartedAt" TIMESTAMP(3),
    "curationClosedAt" TIMESTAMP(3),
    "assembledAt" TIMESTAMP(3),
    "closedNoticeSentAt" TIMESTAMP(3),
    "resultsNoticeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallSubmission" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "basesAcceptedAt" TIMESTAMP(3) NOT NULL,
    "rightsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalCallSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallWork" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "technique" TEXT,
    "statement" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "anonymousCode" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "activityWorkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalCallWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallCurator" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" INTEGER,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedByUserId" INTEGER NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalCallCurator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallScore" (
    "id" TEXT NOT NULL,
    "callWorkId" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalCallScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCall_activityId_key" ON "CulturalCall"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCall_slug_key" ON "CulturalCall"("slug");

-- CreateIndex
CREATE INDEX "CulturalCall_status_closesAt_idx" ON "CulturalCall"("status", "closesAt");

-- CreateIndex
CREATE INDEX "CulturalCall_createdByUserId_idx" ON "CulturalCall"("createdByUserId");

-- CreateIndex
CREATE INDEX "CulturalCallSubmission_userId_idx" ON "CulturalCallSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallSubmission_callId_userId_key" ON "CulturalCallSubmission"("callId", "userId");

-- CreateIndex
CREATE INDEX "CulturalCallWork_submissionId_idx" ON "CulturalCallWork"("submissionId");

-- CreateIndex
CREATE INDEX "CulturalCallWork_callId_decision_idx" ON "CulturalCallWork"("callId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallWork_callId_anonymousCode_key" ON "CulturalCallWork"("callId", "anonymousCode");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallCurator_tokenHash_key" ON "CulturalCallCurator"("tokenHash");

-- CreateIndex
CREATE INDEX "CulturalCallCurator_userId_idx" ON "CulturalCallCurator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallCurator_callId_email_key" ON "CulturalCallCurator"("callId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallCurator_callId_userId_key" ON "CulturalCallCurator"("callId", "userId");

-- CreateIndex
CREATE INDEX "CulturalCallScore_curatorId_idx" ON "CulturalCallScore"("curatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallScore_callWorkId_curatorId_key" ON "CulturalCallScore"("callWorkId", "curatorId");

-- AddForeignKey
ALTER TABLE "CulturalCall" ADD CONSTRAINT "CulturalCall_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallSubmission" ADD CONSTRAINT "CulturalCallSubmission_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CulturalCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallWork" ADD CONSTRAINT "CulturalCallWork_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CulturalCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallWork" ADD CONSTRAINT "CulturalCallWork_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CulturalCallSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallCurator" ADD CONSTRAINT "CulturalCallCurator_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CulturalCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallScore" ADD CONSTRAINT "CulturalCallScore_callWorkId_fkey" FOREIGN KEY ("callWorkId") REFERENCES "CulturalCallWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallScore" ADD CONSTRAINT "CulturalCallScore_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "CulturalCallCurator"("id") ON DELETE CASCADE ON UPDATE CASCADE;


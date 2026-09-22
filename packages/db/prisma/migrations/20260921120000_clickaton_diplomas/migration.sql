-- Cada ALTER TYPE va solo: PostgreSQL no permite usar un valor de enum
-- recién agregado dentro de la misma transacción.
ALTER TYPE "ClickatonParticipantCardType" ADD VALUE IF NOT EXISTS 'DIPLOMA';
ALTER TYPE "DnxMediaAssetKind" ADD VALUE IF NOT EXISTS 'PARTICIPANT_CARD_PDF';

ALTER TABLE "ClickatonParticipantCard"
  ADD COLUMN IF NOT EXISTS "pdfAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfStorageKey" TEXT;

CREATE TABLE IF NOT EXISTS "ClickatonDiplomaIssue" (
  "id" TEXT NOT NULL,
  "cardId" TEXT,
  "registrationId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "diplomaCode" TEXT NOT NULL,
  "verificationToken" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "emailStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
  "emailSentAt" TIMESTAMP(3),
  "emailLastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonDiplomaIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_verificationToken_key"
  ON "ClickatonDiplomaIssue" ("verificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_diplomaCode_key"
  ON "ClickatonDiplomaIssue" ("diplomaCode");
-- Un solo diploma vigente por inscripción; los revocados quedan como historia.
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_registration_active_key"
  ON "ClickatonDiplomaIssue" ("registrationId") WHERE "revokedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_edition_idx"
  ON "ClickatonDiplomaIssue" ("editionId", "emailStatus");
CREATE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_cardId_idx"
  ON "ClickatonDiplomaIssue" ("cardId");

ALTER TABLE "ClickatonDiplomaIssue"
  ADD CONSTRAINT "ClickatonDiplomaIssue_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonDiplomaIssue"
  ADD CONSTRAINT "ClickatonDiplomaIssue_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClickatonDiplomaIssue"
  ADD CONSTRAINT "ClickatonDiplomaIssue_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "ClickatonParticipantCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ETAPA 10B.6 — mapa de cutover Clickatón + alias de identidad
-- Forward-only. No copia datos. No usa db push.

CREATE TYPE "ClickatonLegacyUserResolution" AS ENUM (
  'MATCH_EMAIL_VERIFIED',
  'MATCH_EXTERNAL_IDENTITY',
  'CREATE_CANONICAL_USER',
  'MANUAL_REVIEW',
  'TECHNICAL_USER',
  'INVALID'
);

CREATE TABLE "ClickatonLegacyUserMap" (
  "id" TEXT NOT NULL,
  "sourceUserId" INTEGER NOT NULL,
  "canonicalUserId" INTEGER,
  "normalizedEmail" TEXT NOT NULL,
  "resolution" "ClickatonLegacyUserResolution" NOT NULL,
  "confidence" TEXT NOT NULL,
  "notes" TEXT,
  "batchId" TEXT,
  "migratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonLegacyUserMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonLegacyUserMap_sourceUserId_key" ON "ClickatonLegacyUserMap"("sourceUserId");
CREATE INDEX "ClickatonLegacyUserMap_normalizedEmail_idx" ON "ClickatonLegacyUserMap"("normalizedEmail");
CREATE INDEX "ClickatonLegacyUserMap_resolution_idx" ON "ClickatonLegacyUserMap"("resolution");
CREATE INDEX "ClickatonLegacyUserMap_canonicalUserId_idx" ON "ClickatonLegacyUserMap"("canonicalUserId");
CREATE INDEX "ClickatonLegacyUserMap_batchId_idx" ON "ClickatonLegacyUserMap"("batchId");

CREATE TABLE "UserIdentityAlias" (
  "id" TEXT NOT NULL,
  "oldUserId" INTEGER NOT NULL,
  "canonicalUserId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserIdentityAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserIdentityAlias_oldUserId_key" ON "UserIdentityAlias"("oldUserId");
CREATE INDEX "UserIdentityAlias_canonicalUserId_idx" ON "UserIdentityAlias"("canonicalUserId");

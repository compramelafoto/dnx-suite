-- Diseños armados con el diseñador nuevo (TemplateV2): packs de galería y preventa escolar.
-- Aditiva: columnas nuevas opcionales y dos NOT NULL que se relajan. Idempotente.

ALTER TABLE "DesignProject" ALTER COLUMN "orderItemId" DROP NOT NULL;
ALTER TABLE "DesignProject" ALTER COLUMN "templateId" DROP NOT NULL;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "templateV2Id" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "templateV2VersionId" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "albumOrderId" INTEGER;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "albumPackDraftId" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "albumId" INTEGER;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "photographerUserId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "DesignProject_albumPackDraftId_key" ON "DesignProject"("albumPackDraftId");
CREATE INDEX IF NOT EXISTS "DesignProject_photographerUserId_status_idx" ON "DesignProject"("photographerUserId", "status");
CREATE INDEX IF NOT EXISTS "DesignProject_albumOrderId_idx" ON "DesignProject"("albumOrderId");

ALTER TABLE "BenefitDefinition" ADD COLUMN IF NOT EXISTS "templateV2Id" TEXT;

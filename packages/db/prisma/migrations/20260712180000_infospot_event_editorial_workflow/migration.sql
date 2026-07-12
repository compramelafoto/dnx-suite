-- Info Spot: alinear InfoSpotEvent al workflow editorial genérico
-- (mismo set de estados que InfoSpotArticleStatus).
--
-- Mapeo semántico de datos existentes:
--   PENDING_REVIEW → IN_REVIEW
--   REJECTED       → DRAFT  (motivo preservado en internalNotes + observación)
--   DRAFT / PUBLISHED / ARCHIVED sin cambio de significado
--
-- InfoSpotEventSubmissionStatus (PENDING_REVIEW / APPROVED / REJECTED) NO se modifica:
-- pertenece al intake público, no al workflow editorial.

-- 1) Preservar motivos de rechazo antes de cambiar el enum
UPDATE "InfoSpotEvent"
SET "internalNotes" = CASE
  WHEN "internalNotes" IS NULL OR btrim("internalNotes") = '' THEN
    '[Migración editorial] Evento rechazado (estado legacy REJECTED). Revisar y reenviar a revisión.'
  ELSE
    "internalNotes" || E'\n\n[Migración editorial] Estado legacy REJECTED → DRAFT. Motivo/notas anteriores conservados arriba.'
END
WHERE "status"::text = 'REJECTED';

-- 2) Recrear enum de forma segura (PostgreSQL no permite borrar valores fácilmente)
ALTER TYPE "InfoSpotEventStatus" RENAME TO "InfoSpotEventStatus_legacy";

CREATE TYPE "InfoSpotEventStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED'
);

ALTER TABLE "InfoSpotEvent"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InfoSpotEvent"
  ALTER COLUMN "status" TYPE "InfoSpotEventStatus"
  USING (
    CASE "status"::text
      WHEN 'PENDING_REVIEW' THEN 'IN_REVIEW'::"InfoSpotEventStatus"
      WHEN 'REJECTED' THEN 'DRAFT'::"InfoSpotEventStatus"
      WHEN 'DRAFT' THEN 'DRAFT'::"InfoSpotEventStatus"
      WHEN 'PUBLISHED' THEN 'PUBLISHED'::"InfoSpotEventStatus"
      WHEN 'ARCHIVED' THEN 'ARCHIVED'::"InfoSpotEventStatus"
      ELSE 'DRAFT'::"InfoSpotEventStatus"
    END
  );

ALTER TABLE "InfoSpotEvent"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"InfoSpotEventStatus";

DROP TYPE "InfoSpotEventStatus_legacy";

-- 3) Autor editorial + auditoría
ALTER TABLE "InfoSpotEvent"
  ADD COLUMN IF NOT EXISTS "authorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "submittedForReviewAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedForReviewByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "publishedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "unpublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnedByUserId" INTEGER;

-- Backfill: envíos públicos en revisión quedan con submittedForReviewAt
UPDATE "InfoSpotEvent" e
SET
  "submittedForReviewAt" = COALESCE(e."submittedForReviewAt", s."createdAt", e."createdAt"),
  "contentTag" = CASE
    WHEN e."status" = 'PUBLISHED' AND e."contentTag" = 'NEEDS_REVIEW' THEN 'REAL'::"InfoSpotContentTag"
    ELSE e."contentTag"
  END
FROM "InfoSpotEventSubmission" s
WHERE s."eventId" = e."id"
  AND e."status" = 'IN_REVIEW'
  AND e."submittedForReviewAt" IS NULL;

-- Eventos publicados: asegurar publishedAt si faltara
UPDATE "InfoSpotEvent"
SET "publishedAt" = COALESCE("publishedAt", "updatedAt", "createdAt")
WHERE "status" = 'PUBLISHED'
  AND "publishedAt" IS NULL;

-- 4) Observaciones editoriales de eventos
DO $$ BEGIN
  CREATE TYPE "InfoSpotEventObservationType" AS ENUM ('RETURN', 'NOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InfoSpotEventObservation" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "authorUserId" INTEGER NOT NULL,
  "type" "InfoSpotEventObservationType" NOT NULL DEFAULT 'RETURN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InfoSpotEventObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InfoSpotEventObservation_eventId_createdAt_idx"
  ON "InfoSpotEventObservation"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "InfoSpotEventObservation_authorUserId_idx"
  ON "InfoSpotEventObservation"("authorUserId");
CREATE INDEX IF NOT EXISTS "InfoSpotEventObservation_type_idx"
  ON "InfoSpotEventObservation"("type");

-- Observación histórica para eventos que eran REJECTED (ahora DRAFT con nota de migración).
-- Idempotente: id estable mig_rej_<eventId> + NOT EXISTS por eventId.
-- Autor: reviewedBy → submittedBy → cualquier User existente (nunca inventar id huérfano).
INSERT INTO "InfoSpotEventObservation" ("id", "eventId", "message", "authorUserId", "type", "createdAt")
SELECT
  'mig_rej_' || e."id",
  e."id",
  COALESCE(
    NULLIF(btrim(e."internalNotes"), ''),
    'Evento rechazado en el flujo legacy. Corregí y volvé a enviar a revisión.'
  ),
  COALESCE(
    e."reviewedByUserId",
    e."submittedByUserId",
    (SELECT u."id" FROM "User" u ORDER BY u."id" ASC LIMIT 1)
  ),
  'RETURN'::"InfoSpotEventObservationType",
  COALESCE(e."updatedAt", e."createdAt")
FROM "InfoSpotEvent" e
WHERE e."internalNotes" LIKE '%Estado legacy REJECTED%'
  AND NOT EXISTS (
    SELECT 1 FROM "InfoSpotEventObservation" o WHERE o."eventId" = e."id"
  )
  AND EXISTS (SELECT 1 FROM "User" u LIMIT 1)
  AND COALESCE(
    e."reviewedByUserId",
    e."submittedByUserId",
    (SELECT u."id" FROM "User" u ORDER BY u."id" ASC LIMIT 1)
  ) IS NOT NULL;
-- Marcar returnedAt en esos casos
UPDATE "InfoSpotEvent"
SET
  "returnedAt" = COALESCE("returnedAt", "updatedAt", "createdAt"),
  "returnedByUserId" = COALESCE("returnedByUserId", "reviewedByUserId")
WHERE "internalNotes" LIKE '%Estado legacy REJECTED%';

-- 5) FKs e índices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InfoSpotEvent_authorId_fkey'
  ) THEN
    ALTER TABLE "InfoSpotEvent"
      ADD CONSTRAINT "InfoSpotEvent_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InfoSpotEventObservation_eventId_fkey'
  ) THEN
    ALTER TABLE "InfoSpotEventObservation"
      ADD CONSTRAINT "InfoSpotEventObservation_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "InfoSpotEvent"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InfoSpotEventObservation_authorUserId_fkey'
  ) THEN
    ALTER TABLE "InfoSpotEventObservation"
      ADD CONSTRAINT "InfoSpotEventObservation_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InfoSpotEvent_authorId_idx" ON "InfoSpotEvent"("authorId");
CREATE INDEX IF NOT EXISTS "InfoSpotEvent_submittedForReviewAt_idx" ON "InfoSpotEvent"("submittedForReviewAt");
CREATE INDEX IF NOT EXISTS "InfoSpotEvent_returnedAt_idx" ON "InfoSpotEvent"("returnedAt");
CREATE INDEX IF NOT EXISTS "InfoSpotEvent_approvedAt_idx" ON "InfoSpotEvent"("approvedAt");

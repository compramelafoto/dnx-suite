-- Additive: public visibility gate for DNX Partner participations (Stage 05 Imp 02).
-- Confirmed ≠ HIDDEN until ops publish after logo approval.
-- Backfill keeps currently live participations PUBLIC so SFEF/existing landings do not disappear.

CREATE TYPE "DnxPartnerPublicVisibility" AS ENUM ('HIDDEN', 'PUBLIC');

ALTER TABLE "DnxPartnerParticipation"
  ADD COLUMN "publicVisibility" "DnxPartnerPublicVisibility" NOT NULL DEFAULT 'HIDDEN';

UPDATE "DnxPartnerParticipation"
SET "publicVisibility" = 'PUBLIC'
WHERE "archivedAt" IS NULL
  AND "status" IN ('CONFIRMED', 'ACTIVE', 'COMPLETED');

CREATE INDEX "DnxPartnerParticipation_publicVisibility_idx"
  ON "DnxPartnerParticipation"("publicVisibility");

CREATE INDEX "DnxPartnerParticipation_context_public_idx"
  ON "DnxPartnerParticipation"("application", "contextType", "contextId", "publicVisibility", "status");

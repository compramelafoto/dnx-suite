-- EXAMPLE reconstruction for 20260711160000_infospot_role_audit (10C3).
-- NOT byte-identical to Neon orphan checksum 6f8e61ef... — Strategy C requires checksum UPDATE after repair.
-- Semantic intent observed on Neon: InfoSpotUserRole.lastChangedAt (nullable timestamp).
ALTER TABLE "InfoSpotUserRole" ADD COLUMN IF NOT EXISTS "lastChangedAt" TIMESTAMP(3);

-- Info Spot: flags de override editorial para sync inbound CLF → Event.
-- No altera estados editoriales ni soft refs de artículos.

ALTER TABLE "InfoSpotEvent"
  ADD COLUMN "titleOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "summaryOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "categoryOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "coverOverridden" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "InfoSpotEvent"."titleOverridden" IS
  'Si true, sync CLF no sobrescribe title.';
COMMENT ON COLUMN "InfoSpotEvent"."descriptionOverridden" IS
  'Si true, sync CLF no sobrescribe description.';
COMMENT ON COLUMN "InfoSpotEvent"."summaryOverridden" IS
  'Si true, sync CLF no sobrescribe summary.';
COMMENT ON COLUMN "InfoSpotEvent"."categoryOverridden" IS
  'Si true, sync CLF no sobrescribe categoryId.';
COMMENT ON COLUMN "InfoSpotEvent"."coverOverridden" IS
  'Si true, sync CLF no sobrescribe coverImageUrl/coverImageKey.';

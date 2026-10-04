-- Pack destacado del catálogo público de preventa ("Recomendado").
-- Como mucho uno por álbum; la regla la aplica pack-service, no la base.
ALTER TABLE "PackDefinition"
  ADD COLUMN IF NOT EXISTS "isRecommended" BOOLEAN NOT NULL DEFAULT false;

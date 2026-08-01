-- Controles admin: deshabilitar / reordenar banners automáticos del Home.
ALTER TABLE "ClickatonHomeBannerSettings"
ADD COLUMN IF NOT EXISTS "systemSlidesConfig" JSONB;

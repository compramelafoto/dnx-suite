-- Por foto: vender solo digital, solo impresa o ambos
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "sellDigital" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "sellPrint" BOOLEAN NOT NULL DEFAULT true;

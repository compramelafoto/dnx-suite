-- Sorteos de CLF: portada, sponsors con logo y foto de cada premio. Sólo columnas nuevas.
ALTER TABLE "ClfRaffle" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "ClfRaffle" ADD COLUMN IF NOT EXISTS "sponsors" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ClfRafflePrize" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "ClfRafflePrize" ADD COLUMN IF NOT EXISTS "sponsorLogoUrl" TEXT;
ALTER TABLE "ClfRafflePrize" ADD COLUMN IF NOT EXISTS "sponsorUrl" TEXT;
ALTER TABLE "ClfRaffleSettings" ADD COLUMN IF NOT EXISTS "monthlyCoverImageUrl" TEXT;
ALTER TABLE "ClfRaffleSettings" ADD COLUMN IF NOT EXISTS "monthlySponsors" JSONB NOT NULL DEFAULT '[]';

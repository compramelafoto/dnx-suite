-- El logo del aliado viaja con el premio, para que la tarjeta del sorteo se siga viendo
-- igual dentro de dos años aunque la marca cambie.
ALTER TABLE "RafflePrize" ADD COLUMN "partnerLogoSnapshot" TEXT;
ALTER TABLE "RafflePrizeCommitment" ADD COLUMN "partnerLogoSnapshot" TEXT;

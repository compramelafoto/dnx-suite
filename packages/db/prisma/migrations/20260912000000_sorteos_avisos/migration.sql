-- Los avisos del sorteo y el respaldo del premio. Puramente aditiva: sólo columnas nuevas,
-- todas opcionales o con valor por omisión.

-- Cuántos días tiene el ganador para retirar. El plazo corre desde el sorteo.
ALTER TABLE "Raffle" ADD COLUMN "pickupDays" INTEGER NOT NULL DEFAULT 15;

-- Dónde se retira el premio y a quién pedirle el comprobante. Instantáneas, como el nombre:
-- el correo al ganador ya salió con estos datos y tiene que seguir coincidiendo.
ALTER TABLE "RafflePrize" ADD COLUMN "partnerEmailSnapshot" TEXT;
ALTER TABLE "RafflePrize" ADD COLUMN "partnerAddressSnapshot" TEXT;
ALTER TABLE "RafflePrize" ADD COLUMN "partnerPhoneSnapshot" TEXT;
ALTER TABLE "RafflePrize" ADD COLUMN "partnerHoursSnapshot" TEXT;

-- Los dos avisos, cada uno con su error si no salió.
ALTER TABLE "RafflePrizeAward" ADD COLUMN "noticeError" TEXT;
ALTER TABLE "RafflePrizeAward" ADD COLUMN "sponsorNotifiedAt" TIMESTAMP(3);
ALTER TABLE "RafflePrizeAward" ADD COLUMN "sponsorNoticeError" TEXT;

-- El remito que manda el aliado cuando el socio retira.
ALTER TABLE "RafflePrizeAward" ADD COLUMN "receiptReceivedAt" TIMESTAMP(3);
ALTER TABLE "RafflePrizeAward" ADD COLUMN "receiptFileUrl" TEXT;
ALTER TABLE "RafflePrizeAward" ADD COLUMN "receiptNote" TEXT;

-- Lo que el cron busca para reintentar: premios sin avisar.
CREATE INDEX "RafflePrizeAward_notifiedAt_idx" ON "RafflePrizeAward"("notifiedAt");
CREATE INDEX "RafflePrizeAward_sponsorNotifiedAt_idx" ON "RafflePrizeAward"("sponsorNotifiedAt");

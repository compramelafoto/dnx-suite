-- Entrega y apertura de los correos registrados (avisos de Resend).
ALTER TABLE "FotofficeMessage" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "FotofficeMessage" ADD COLUMN "openedAt" TIMESTAMP(3);
CREATE INDEX "FotofficeMessage_providerId_idx" ON "FotofficeMessage"("providerId");

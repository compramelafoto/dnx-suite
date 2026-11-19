-- Seguimiento de los correos a clientes y consultas: avisos de Resend (entregado, abierto, clic, rebote, spam).
ALTER TABLE "FotofficeMessage" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "FotofficeMessage" ADD COLUMN "openedAt" TIMESTAMP(3);
ALTER TABLE "FotofficeMessage" ADD COLUMN "clickedAt" TIMESTAMP(3);
ALTER TABLE "FotofficeMessage" ADD COLUMN "bouncedAt" TIMESTAMP(3);
ALTER TABLE "FotofficeMessage" ADD COLUMN "complainedAt" TIMESTAMP(3);
CREATE INDEX "FotofficeMessage_providerId_idx" ON "FotofficeMessage"("providerId");

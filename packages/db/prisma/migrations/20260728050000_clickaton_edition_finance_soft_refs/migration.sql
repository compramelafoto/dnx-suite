-- Etapa 5 Clickatón: soft refs de distribución financiera en inscripción + auditoría.

ALTER TABLE "ClickatonRegistration"
ADD COLUMN "financialAgreementId" TEXT,
ADD COLUMN "financialDistributionVersionId" TEXT,
ADD COLUMN "financialDistributionVersionNumber" INTEGER,
ADD COLUMN "financialDistributionSnapshot" JSONB;

CREATE INDEX "ClickatonRegistration_financialAgreementId_idx"
ON "ClickatonRegistration"("financialAgreementId");

CREATE INDEX "ClickatonRegistration_financialDistributionVersionId_idx"
ON "ClickatonRegistration"("financialDistributionVersionId");

CREATE TABLE "ClickatonEditionFinanceAudit" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "agreementId" TEXT,
    "versionId" TEXT,
    "actorUserId" INTEGER,
    "action" TEXT NOT NULL,
    "previousValue" JSONB,
    "nextValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickatonEditionFinanceAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickatonEditionFinanceAudit_editionId_createdAt_idx"
ON "ClickatonEditionFinanceAudit"("editionId", "createdAt");

CREATE INDEX "ClickatonEditionFinanceAudit_agreementId_idx"
ON "ClickatonEditionFinanceAudit"("agreementId");

CREATE INDEX "ClickatonEditionFinanceAudit_actorUserId_idx"
ON "ClickatonEditionFinanceAudit"("actorUserId");

ALTER TABLE "ClickatonEditionFinanceAudit"
ADD CONSTRAINT "ClickatonEditionFinanceAudit_editionId_fkey"
FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClickatonEditionFinanceAudit"
ADD CONSTRAINT "ClickatonEditionFinanceAudit_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

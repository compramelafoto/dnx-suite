-- Correo a socios, etapa 3: fechas especiales, cumpleaños y aniversario de ingreso.
ALTER TABLE "FotofficeEmailCampaign" ADD COLUMN "occasionKey" TEXT;

CREATE TABLE "FotofficeMailingOccasion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "month" INTEGER,
    "day" INTEGER,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "milestonesOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeMailingOccasion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeMailingOccasion_workspaceId_key_key" ON "FotofficeMailingOccasion"("workspaceId", "key");

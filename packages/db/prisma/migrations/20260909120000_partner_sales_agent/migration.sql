-- Vendedores habilitados a ofrecer inventario publicitario.
--
-- Existe porque `soldByOrganizationId` es una referencia opaca: puede apuntar a
-- un workspace de FotoOffice o a una organización de concurso, que viven en
-- lugares distintos. Sin esta tabla no hay forma de listar vendedores con su
-- nombre, ni de declarar quién puede ofrecer la red y quién solo lo suyo.
--
-- Aditiva: crea un enum y una tabla vacía. No toca datos existentes.

CREATE TYPE "DnxPartnerSalesAgentStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "DnxPartnerSalesAgent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "canSellPlatform" BOOLEAN NOT NULL DEFAULT false,
    "status" "DnxPartnerSalesAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPartnerSalesAgent_pkey" PRIMARY KEY ("id")
);

-- Una organización se habilita una sola vez.
CREATE UNIQUE INDEX "DnxPartnerSalesAgent_organizationId_key"
  ON "DnxPartnerSalesAgent" ("organizationId");

CREATE INDEX "DnxPartnerSalesAgent_status_idx"
  ON "DnxPartnerSalesAgent" ("status");

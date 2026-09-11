-- Propuestas comerciales guardadas, con código recuperable y vencimiento.
--
-- Hasta ahora el generador de `/propuesta` componía y devolvía: si el cliente
-- contestaba a los diez días, el vendedor tenía que rehacerla y volver a pedir
-- el logo. Estas dos tablas guardan lo mínimo para recuperarla con un código
-- corto.
--
-- Son deliberadamente efímeras: `expiresAt` a treinta días y una tarea diaria
-- las borra junto con el logo. La alternativa —crear el sponsor al armar la
-- propuesta— llenaría la cartera real de marcas que nunca contestaron.
--
-- Aditiva: crea tres enums y dos tablas vacías. No toca datos existentes.

CREATE TYPE "DnxPartnerProposalStatus" AS ENUM ('DRAFT', 'READY', 'CONVERTED', 'EXPIRED');

CREATE TYPE "DnxPartnerProposalItemKind" AS ENUM ('DIGITAL_PLACEMENT', 'PHYSICAL', 'MERCHANDISING', 'MENTION');

CREATE TYPE "DnxPartnerProposalItemSelection" AS ENUM ('INCLUDED', 'OPTIONAL', 'EXCLUDED');

CREATE TABLE "DnxPartnerProposal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "DnxPartnerProposalStatus" NOT NULL DEFAULT 'READY',
    "brandName" TEXT NOT NULL,
    "industry" TEXT,
    "contactUrl" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "logoStorageKey" TEXT,
    "logoMeta" JSONB,
    "pdfStorageKey" TEXT,
    "createdByUserId" INTEGER,
    "clientKeyHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedPartnerId" TEXT,
    "convertedByUserId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPartnerProposal_pkey" PRIMARY KEY ("id")
);

-- El código es la única llave para recuperar la propuesta: dos iguales harían
-- que un vendedor abriera la de otro. La unicidad la garantiza este índice, no
-- el generador.
CREATE UNIQUE INDEX "DnxPartnerProposal_code_key"
  ON "DnxPartnerProposal" ("code");

-- El barrido diario busca por estado y vencimiento.
CREATE INDEX "DnxPartnerProposal_status_expiresAt_idx"
  ON "DnxPartnerProposal" ("status", "expiresAt");

CREATE INDEX "DnxPartnerProposal_brandName_idx"
  ON "DnxPartnerProposal" ("brandName");

CREATE TABLE "DnxPartnerProposalItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "kind" "DnxPartnerProposalItemKind" NOT NULL DEFAULT 'DIGITAL_PLACEMENT',
    "pieceId" TEXT,
    "placementKey" TEXT,
    "label" TEXT NOT NULL,
    "location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER,
    "currency" TEXT,
    "selection" "DnxPartnerProposalItemSelection" NOT NULL DEFAULT 'INCLUDED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxPartnerProposalItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerProposalItem_proposalId_sortOrder_idx"
  ON "DnxPartnerProposalItem" ("proposalId", "sortOrder");

-- En cascada: una línea sin propuesta no significa nada, y el barrido diario
-- borra la propuesta sin tener que acordarse de las líneas.
ALTER TABLE "DnxPartnerProposalItem"
  ADD CONSTRAINT "DnxPartnerProposalItem_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "DnxPartnerProposal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

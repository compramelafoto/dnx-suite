-- Etapa 4 Clickatón: orden visual de variantes + fulfillment por ítem + snapshots.

CREATE TYPE "ClickatonItemFulfillmentStatus" AS ENUM ('PENDING', 'READY', 'DELIVERED', 'CANCELLED');

ALTER TABLE "ClickatonProductVariant"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;

CREATE INDEX "ClickatonProductVariant_productId_sortOrder_idx"
ON "ClickatonProductVariant"("productId", "sortOrder");

ALTER TABLE "ClickatonRegistrationItem"
ADD COLUMN "ticketTypeItemId" TEXT,
ADD COLUMN "variantNameSnapshot" TEXT,
ADD COLUMN "fulfillmentStatus" "ClickatonItemFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "fulfilledAt" TIMESTAMP(3),
ADD COLUMN "fulfilledByUserId" INTEGER;

CREATE INDEX "ClickatonRegistrationItem_fulfillmentStatus_idx"
ON "ClickatonRegistrationItem"("fulfillmentStatus");

CREATE INDEX "ClickatonRegistrationItem_ticketTypeItemId_idx"
ON "ClickatonRegistrationItem"("ticketTypeItemId");

ALTER TABLE "ClickatonRegistrationItem"
ADD CONSTRAINT "ClickatonRegistrationItem_fulfilledByUserId_fkey"
FOREIGN KEY ("fulfilledByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

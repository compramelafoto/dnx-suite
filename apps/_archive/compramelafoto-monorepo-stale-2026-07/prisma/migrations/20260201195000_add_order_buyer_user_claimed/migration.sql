-- Add Order.buyerUserId and Order.claimedAt (optional FK to User for logged-in buyers)
ALTER TABLE "Order"
ADD COLUMN "buyerUserId" INTEGER,
ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "Order_buyerUserId_idx" ON "Order"("buyerUserId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

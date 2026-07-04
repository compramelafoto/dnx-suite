-- Make PrintOrder.labId optional: when photographer has no lab selected,
-- the order goes to the photographer and prices come from their product list.
ALTER TABLE "PrintOrder" ALTER COLUMN "labId" DROP DEFAULT;
ALTER TABLE "PrintOrder" ALTER COLUMN "labId" DROP NOT NULL;

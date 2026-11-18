-- CLF: varios packs de preventa en un solo pago (un pedido por pack, agrupados). Idempotente.
-- Sólo agrega una tabla: no toca "Order".
CREATE TABLE IF NOT EXISTS "OrderPaymentGroup" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "orderIds" INTEGER[],
    "totalArs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderPaymentGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderPaymentGroup_orderIds_idx" ON "OrderPaymentGroup" USING GIN ("orderIds");
CREATE INDEX IF NOT EXISTS "OrderPaymentGroup_albumId_idx" ON "OrderPaymentGroup"("albumId");
CREATE INDEX IF NOT EXISTS "OrderPaymentGroup_mpPaymentId_idx" ON "OrderPaymentGroup"("mpPaymentId");

-- Solicitudes de arrepentimiento.
--
-- La Resolución 424/2020 exige un botón visible en la portada y una constancia de la
-- solicitud. La constancia necesita quedar registrada: sin tabla no hay número que dar,
-- y el número es justamente lo que la persona guarda como prueba de que pidió.
CREATE TABLE "SubilafotoRetractionRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "receipt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "orderId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoRetractionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubilafotoRetractionRequest_receipt_key" ON "SubilafotoRetractionRequest"("receipt");
CREATE INDEX "SubilafotoRetractionRequest_status_createdAt_idx" ON "SubilafotoRetractionRequest"("status", "createdAt");
CREATE INDEX "SubilafotoRetractionRequest_email_idx" ON "SubilafotoRetractionRequest"("email");

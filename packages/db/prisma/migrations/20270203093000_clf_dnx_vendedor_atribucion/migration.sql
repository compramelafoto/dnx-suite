-- Atribución de registros de CLF al agente Vendedor de DNX (cookie clf_dnxv).
-- Aditivo e idempotente. Sin FK a "User" a propósito.
CREATE TABLE IF NOT EXISTS "DnxVendedorAtribucion" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "rol" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxVendedorAtribucion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorAtribucion_userId_key" ON "DnxVendedorAtribucion"("userId");
CREATE INDEX IF NOT EXISTS "DnxVendedorAtribucion_token_idx" ON "DnxVendedorAtribucion"("token");

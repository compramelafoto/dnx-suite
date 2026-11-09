-- Agente Vendedor de DNX: casillas dadas de baja.
-- Una baja vale por la dirección, haya o no un contacto con esa casilla: el Vendedor no le escribe
-- más a ninguna dirección de esta tabla. Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS "DnxVendedorBaja" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxVendedorBaja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorBaja_email_key" ON "DnxVendedorBaja"("email");

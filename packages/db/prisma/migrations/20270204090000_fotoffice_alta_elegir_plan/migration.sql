-- Alta corta con elección de plan: qué categorías se ofrecen en el formulario público
-- de asociación. Aditivo: una columna con valor por omisión (false = como hoy).
-- Idempotente: se puede correr dos veces.

-- AlterTable
ALTER TABLE "MemberCategory" ADD COLUMN IF NOT EXISTS "offeredInOnlineApplication" BOOLEAN NOT NULL DEFAULT false;

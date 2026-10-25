-- Seña en todos los productos: marca del flujo "Para retirar" y clave de alta del pedido.
-- Idempotente: se puede correr dos veces sin efecto.

ALTER TABLE "FotofficeCircuit" ADD COLUMN IF NOT EXISTS "systemKey" TEXT;
ALTER TABLE "FotofficePedido" ADD COLUMN IF NOT EXISTS "altaKey" TEXT;

-- Un flujo de sistema por clave y workspace (los comunes tienen systemKey null y no entran).
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeCircuit_workspaceId_systemKey_key"
  ON "FotofficeCircuit" ("workspaceId", "systemKey")
  WHERE "systemKey" IS NOT NULL;

-- Un pedido por venta de origen: reintentar el alta no lo duplica.
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePedido_workspaceId_altaKey_key"
  ON "FotofficePedido" ("workspaceId", "altaKey")
  WHERE "altaKey" IS NOT NULL;

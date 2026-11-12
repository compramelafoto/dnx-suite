-- Interruptor propio para que el bot de WhatsApp acredite solo los pagos por transferencia
-- cuando el comprobante coincide con Mercado Pago (antes usaba autoConfirmarPedido, de Presupuestos).
-- Aditivo: una columna con valor por omisión (false = apagado). Idempotente: se puede correr dos veces.

-- AlterTable
ALTER TABLE "FotofficeCobroAjustes" ADD COLUMN IF NOT EXISTS "autoAcreditarComprobante" BOOLEAN NOT NULL DEFAULT false;

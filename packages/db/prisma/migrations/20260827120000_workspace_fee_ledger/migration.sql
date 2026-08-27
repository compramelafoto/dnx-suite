-- FotOffice — libro de la comisión que la institución le debe a la plataforma.
--
-- Contexto: el dinero de las cuotas nunca pasa por DNX. El socio paga a la cuenta de Mercado
-- Pago de la institución y MP retiene la comisión en la misma operación. Un pago en efectivo o
-- por transferencia no pasa por ahí, así que esa comisión queda a deber y se cobra de los
-- siguientes pagos que sí entren por Mercado Pago.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — migración ADITIVA:
--   * Solo crea un enum y una tabla nuevos. No modifica ni lee ninguna existente.
--   * Sin filas, el comportamiento actual no cambia: la comisión se sigue reteniendo en cada
--     pago de Mercado Pago exactamente como hasta ahora.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceFeeLedgerKind') THEN
    CREATE TYPE "WorkspaceFeeLedgerKind" AS ENUM ('DEVENGADO', 'RETENIDO', 'SALDADO_MANUAL', 'REVERSADO');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "WorkspaceFeeLedgerEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "WorkspaceFeeLedgerKind" NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "membershipPaymentId" TEXT,
    "note" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceFeeLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceFeeLedgerEntry_workspaceId_createdAt_idx"
  ON "WorkspaceFeeLedgerEntry"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceFeeLedgerEntry_membershipPaymentId_idx"
  ON "WorkspaceFeeLedgerEntry"("membershipPaymentId");

ALTER TABLE "WorkspaceFeeLedgerEntry"
  ADD CONSTRAINT "WorkspaceFeeLedgerEntry_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceFeeLedgerEntry"
  ADD CONSTRAINT "WorkspaceFeeLedgerEntry_membershipPaymentId_fkey"
  FOREIGN KEY ("membershipPaymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkspaceFeeLedgerEntry"
  ADD CONSTRAINT "WorkspaceFeeLedgerEntry_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

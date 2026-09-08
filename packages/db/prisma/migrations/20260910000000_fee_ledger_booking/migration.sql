-- El libro de comisiones puede referirse a una reserva, no solo a un pago de cuota.
-- Columna nullable: los asientos existentes quedan como están.

ALTER TABLE "WorkspaceFeeLedgerEntry" ADD COLUMN "bookingId" TEXT;

CREATE INDEX "WorkspaceFeeLedgerEntry_bookingId_idx" ON "WorkspaceFeeLedgerEntry"("bookingId");

ALTER TABLE "WorkspaceFeeLedgerEntry" ADD CONSTRAINT "WorkspaceFeeLedgerEntry_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

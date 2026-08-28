-- Cupo, disponibilidad y reserva del inventario publicitario.
--
-- Aditiva: crea un enum, una tabla y sus índices. No toca datos existentes.
--
-- Lo importante de esta migración no es la tabla, es la última sentencia. Un
-- control en la aplicación no alcanza: si dos transacciones confirman el último
-- cupo al mismo tiempo, las dos leen "hay lugar" y las dos escriben. La
-- restricción de exclusión es lo único que lo impide de verdad.

CREATE TYPE "DnxPartnerBookingStatus" AS ENUM ('DRAFT', 'RESERVED', 'SOLD', 'CANCELLED');

CREATE TABLE "DnxPartnerInventoryBooking" (
    "id" TEXT NOT NULL,
    "placementKey" TEXT NOT NULL,
    "contextType" "DnxPartnerContextType" NOT NULL DEFAULT 'GLOBAL',
    "contextId" TEXT,
    "partnerId" TEXT NOT NULL,
    "participationId" TEXT,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "DnxPartnerBookingStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reservationExpiresAt" TIMESTAMP(3),
    "reservationExtensionCount" INTEGER NOT NULL DEFAULT 0,
    "reservationExtendedAt" TIMESTAMP(3),
    "reservationExtendedByUserId" INTEGER,
    "soldByOrganizationId" TEXT,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPartnerInventoryBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerInventoryBooking_placementKey_contextId_status_idx"
  ON "DnxPartnerInventoryBooking" ("placementKey", "contextId", "status");
CREATE INDEX "DnxPartnerInventoryBooking_partnerId_status_idx"
  ON "DnxPartnerInventoryBooking" ("partnerId", "status");
CREATE INDEX "DnxPartnerInventoryBooking_soldByOrganizationId_status_idx"
  ON "DnxPartnerInventoryBooking" ("soldByOrganizationId", "status");
CREATE INDEX "DnxPartnerInventoryBooking_status_endsAt_idx"
  ON "DnxPartnerInventoryBooking" ("status", "endsAt");

ALTER TABLE "DnxPartnerInventoryBooking"
  ADD CONSTRAINT "DnxPartnerInventoryBooking_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerInventoryBooking"
  ADD CONSTRAINT "DnxPartnerInventoryBooking_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricción de exclusión: dos ocupaciones no pueden compartir el mismo lugar
-- de un mismo espacio y contexto en períodos que se pisen.
--
-- `slotIndex` es lo que hace que esto cuente el cupo en vez de bloquear
-- cualquier superposición: una franja de logos con doce lugares admite doce
-- ocupaciones simultáneas, una por índice.
--
-- El rango es `[)` para que una ocupación que termina el 1 de marzo y otra que
-- arranca el 1 de marzo no se consideren superpuestas.
--
-- DRAFT y CANCELLED quedan afuera: una propuesta que se está armando no ocupa.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "DnxPartnerInventoryBooking"
  ADD CONSTRAINT "DnxPartnerInventoryBooking_no_overlap"
  EXCLUDE USING gist (
    "placementKey" WITH =,
    (COALESCE("contextId", '')) WITH =,
    "slotIndex" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('RESERVED', 'SOLD'));

-- Reservas de espacios y sus extras. Puramente aditiva: diez tablas nuevas, ninguna columna
-- existente modificada.

CREATE TABLE "BookingSpace" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "minBookingMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxBookingMinutes" INTEGER,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 90,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "memberHourlyPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nonMemberHourlyPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "memberFreeHoursPerMonth" INTEGER NOT NULL DEFAULT 0,
    "allowsNonMembers" BOOLEAN NOT NULL DEFAULT true,
    "googleCalendarId" TEXT,
    "calendarSyncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingSpace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingSpace_workspaceId_slug_key" ON "BookingSpace"("workspaceId", "slug");
CREATE INDEX "BookingSpace_workspaceId_active_idx" ON "BookingSpace"("workspaceId", "active");
ALTER TABLE "BookingSpace" ADD CONSTRAINT "BookingSpace_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingSpaceHours" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "BookingSpaceHours_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingSpaceHours_spaceId_weekday_idx" ON "BookingSpaceHours"("spaceId", "weekday");
ALTER TABLE "BookingSpaceHours" ADD CONSTRAINT "BookingSpaceHours_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingClosure" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "spaceId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingClosure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingClosure_workspaceId_startAt_idx" ON "BookingClosure"("workspaceId", "startAt");
ALTER TABLE "BookingClosure" ADD CONSTRAINT "BookingClosure_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingClosure" ADD CONSTRAINT "BookingClosure_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingSpaceCompatibility" (
    "id" TEXT NOT NULL,
    "spaceAId" TEXT NOT NULL,
    "spaceBId" TEXT NOT NULL,
    CONSTRAINT "BookingSpaceCompatibility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingSpaceCompatibility_spaceAId_spaceBId_key"
    ON "BookingSpaceCompatibility"("spaceAId", "spaceBId");
CREATE INDEX "BookingSpaceCompatibility_spaceBId_idx" ON "BookingSpaceCompatibility"("spaceBId");
ALTER TABLE "BookingSpaceCompatibility" ADD CONSTRAINT "BookingSpaceCompatibility_spaceAId_fkey"
    FOREIGN KEY ("spaceAId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingSpaceCompatibility" ADD CONSTRAINT "BookingSpaceCompatibility_spaceBId_fkey"
    FOREIGN KEY ("spaceBId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "memberId" TEXT,
    "userId" INTEGER,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "customerType" TEXT NOT NULL,
    "billedMinutes" INTEGER NOT NULL,
    "freeMinutesUsed" INTEGER NOT NULL DEFAULT 0,
    "hourlyPriceArs" DECIMAL(12,2) NOT NULL,
    "totalArs" DECIMAL(12,2) NOT NULL,
    "feeBps" INTEGER NOT NULL DEFAULT 0,
    "feeArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "decidedByUserId" INTEGER,
    "googleEventId" TEXT,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" INTEGER,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Booking_workspaceId_startAt_idx" ON "Booking"("workspaceId", "startAt");
CREATE INDEX "Booking_spaceId_startAt_idx" ON "Booking"("spaceId", "startAt");
CREATE INDEX "Booking_memberId_startAt_idx" ON "Booking"("memberId", "startAt");
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "holdHours" INTEGER NOT NULL DEFAULT 24,
    "cancelWindowHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingSettings_workspaceId_key" ON "BookingSettings"("workspaceId");
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingResource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingResource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingResource_workspaceId_idx" ON "BookingResource"("workspaceId");
ALTER TABLE "BookingResource" ADD CONSTRAINT "BookingResource_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingExtra" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "priceMode" TEXT NOT NULL DEFAULT 'PER_BOOKING',
    "memberPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nonMemberPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "resourceId" TEXT,
    "unitsConsumed" INTEGER NOT NULL DEFAULT 1,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingExtra_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingExtra_workspaceId_active_idx" ON "BookingExtra"("workspaceId", "active");
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "BookingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BookingExtraSpace" (
    "id" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    CONSTRAINT "BookingExtraSpace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingExtraSpace_extraId_spaceId_key" ON "BookingExtraSpace"("extraId", "spaceId");
CREATE INDEX "BookingExtraSpace_spaceId_idx" ON "BookingExtraSpace"("spaceId");
ALTER TABLE "BookingExtraSpace" ADD CONSTRAINT "BookingExtraSpace_extraId_fkey"
    FOREIGN KEY ("extraId") REFERENCES "BookingExtra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingExtraSpace" ADD CONSTRAINT "BookingExtraSpace_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingExtraLine" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "priceMode" TEXT NOT NULL,
    "unitPriceArs" DECIMAL(12,2) NOT NULL,
    "unitsConsumed" INTEGER NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingExtraLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingExtraLine_bookingId_idx" ON "BookingExtraLine"("bookingId");
CREATE INDEX "BookingExtraLine_extraId_idx" ON "BookingExtraLine"("extraId");
ALTER TABLE "BookingExtraLine" ADD CONSTRAINT "BookingExtraLine_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT y no CASCADE: borrar un extra no puede borrar el registro de lo que alguien
-- contrató y pagó. Un extra se desactiva, no se borra.
ALTER TABLE "BookingExtraLine" ADD CONSTRAINT "BookingExtraLine_extraId_fkey"
    FOREIGN KEY ("extraId") REFERENCES "BookingExtra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── La restricción que hace imposible la doble reserva ──
--
-- Dos personas apretando "Reservar" en el mismo segundo pueden pasar las dos por cualquier
-- verificación hecha en la aplicación: entre el "¿está libre?" y el "guardar" hay un hueco.
-- Esto lo cierra en la base, que es el único lugar donde no hay hueco.
--
-- Cubre un espacio contra sí mismo. Los conflictos ENTRE espacios los resuelve la
-- transacción: expresarlos acá exigiría una tabla de ocupación derivada, y no vale la pena.
--
-- El rango es medio abierto '[)': de 14 a 16 y de 16 a 18 conviven, igual que en time.ts.
--
-- Se usa `tsrange` y NO `tstzrange`: Prisma mapea DateTime a TIMESTAMP(3) SIN zona horaria,
-- así que `tstzrange` obligaría a convertir timestamp -> timestamptz, una conversión que
-- depende de la zona de la sesión y por eso Postgres la considera STABLE, no IMMUTABLE.
-- Un índice no admite expresiones no inmutables y la restricción falla al crearse.
-- Todos los valores guardados son UTC, así que comparar sin zona es correcto.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sin_solapamiento"
  EXCLUDE USING gist (
    "spaceId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE (status IN ('HOLD', 'PENDING_APPROVAL', 'CONFIRMED'));

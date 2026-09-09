-- Lo que se carga a mano en Google Calendar y ocupa un espacio.
-- Tabla nueva, puramente aditiva.

CREATE TABLE "BookingCalendarBlock" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingCalendarBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingCalendarBlock_spaceId_googleEventId_key"
    ON "BookingCalendarBlock"("spaceId", "googleEventId");
CREATE INDEX "BookingCalendarBlock_spaceId_startAt_idx"
    ON "BookingCalendarBlock"("spaceId", "startAt");

ALTER TABLE "BookingCalendarBlock" ADD CONSTRAINT "BookingCalendarBlock_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "BookingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

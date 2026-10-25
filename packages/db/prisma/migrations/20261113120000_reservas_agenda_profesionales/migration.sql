-- Cómo se presenta la agenda al público: espacios para alquilar o turnos con profesionales.
ALTER TABLE "BookingSettings" ADD COLUMN "agendaKind" TEXT NOT NULL DEFAULT 'ESPACIOS';
ALTER TABLE "BookingSettings" ADD COLUMN "resourceSingular" TEXT;
ALTER TABLE "BookingSettings" ADD COLUMN "resourcePlural" TEXT;

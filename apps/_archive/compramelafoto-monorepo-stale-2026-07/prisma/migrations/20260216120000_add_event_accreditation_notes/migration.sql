-- Indicaciones de acreditación para fotógrafos (visible al ver el evento)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "accreditationNotes" TEXT;

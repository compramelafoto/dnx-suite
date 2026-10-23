-- Cam Of Duty: registro de los usuarios de CompraMeLaFoto que entran al simulador o al
-- estudio de luz. Sólo crea una tabla nueva. Idempotente.
CREATE TABLE IF NOT EXISTS "CamOfDutyMember" (
    "userId" INTEGER NOT NULL,
    "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CamOfDutyMember_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "CamOfDutyMember_firstVisitAt_idx" ON "CamOfDutyMember"("firstVisitAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CamOfDutyMember_userId_fkey') THEN
    ALTER TABLE "CamOfDutyMember" ADD CONSTRAINT "CamOfDutyMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Avatar del fotógrafo en Cam Of Duty.
CREATE TABLE IF NOT EXISTS "CamOfDutyAvatar" (
    "userId" INTEGER NOT NULL,
    "figureId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CamOfDutyAvatar_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "CamOfDutyAvatar" ADD CONSTRAINT "CamOfDutyAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

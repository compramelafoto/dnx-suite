-- Curso de fotografía de Cam Of Duty: progreso por lección.
CREATE TABLE IF NOT EXISTS "CamOfDutyLessonProgress" (
    "userId" INTEGER NOT NULL,
    "lessonId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),
    "bestShot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CamOfDutyLessonProgress_pkey" PRIMARY KEY ("userId","lessonId")
);

DO $$ BEGIN
  ALTER TABLE "CamOfDutyLessonProgress" ADD CONSTRAINT "CamOfDutyLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

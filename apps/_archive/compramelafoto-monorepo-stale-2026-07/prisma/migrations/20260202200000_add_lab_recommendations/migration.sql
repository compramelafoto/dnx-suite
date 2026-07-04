-- CreateTable
CREATE TABLE "LabRecommendation" (
    "id" SERIAL NOT NULL,
    "photographerName" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "labEmail" TEXT NOT NULL,
    "labWhatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "LabRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabRecommendation_createdAt_idx" ON "LabRecommendation"("createdAt");

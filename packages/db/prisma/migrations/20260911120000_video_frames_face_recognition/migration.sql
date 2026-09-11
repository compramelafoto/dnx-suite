-- CreateTable
CREATE TABLE "VideoFrame" (
    "id" SERIAL NOT NULL,
    "videoId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "timeSeconds" DOUBLE PRECISION NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sharpness" DOUBLE PRECISION,
    "facesCount" INTEGER NOT NULL DEFAULT 0,
    "analysisStatus" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoFrameFace" (
    "id" SERIAL NOT NULL,
    "videoFrameId" INTEGER NOT NULL,
    "rekognitionFaceId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "bbox" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoFrameFace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoFrameMatch" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "videoId" INTEGER NOT NULL,
    "videoFrameId" INTEGER,
    "timeSeconds" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoFrameMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoFrame_key_key" ON "VideoFrame"("key");

-- CreateIndex
CREATE INDEX "VideoFrame_videoId_idx" ON "VideoFrame"("videoId");

-- CreateIndex
CREATE INDEX "VideoFrame_albumId_idx" ON "VideoFrame"("albumId");

-- CreateIndex
CREATE INDEX "VideoFrame_analysisStatus_idx" ON "VideoFrame"("analysisStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFrame_videoId_timeSeconds_key" ON "VideoFrame"("videoId", "timeSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFrameFace_rekognitionFaceId_key" ON "VideoFrameFace"("rekognitionFaceId");

-- CreateIndex
CREATE INDEX "VideoFrameFace_videoFrameId_idx" ON "VideoFrameFace"("videoFrameId");

-- CreateIndex
CREATE INDEX "VideoFrameMatch_subjectId_idx" ON "VideoFrameMatch"("subjectId");

-- CreateIndex
CREATE INDEX "VideoFrameMatch_videoId_idx" ON "VideoFrameMatch"("videoId");

-- CreateIndex
CREATE INDEX "VideoFrameMatch_videoFrameId_idx" ON "VideoFrameMatch"("videoFrameId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFrameMatch_subjectId_videoId_key" ON "VideoFrameMatch"("subjectId", "videoId");

-- AddForeignKey
ALTER TABLE "VideoFrame" ADD CONSTRAINT "VideoFrame_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrame" ADD CONSTRAINT "VideoFrame_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrameFace" ADD CONSTRAINT "VideoFrameFace_videoFrameId_fkey" FOREIGN KEY ("videoFrameId") REFERENCES "VideoFrame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrameMatch" ADD CONSTRAINT "VideoFrameMatch_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrameMatch" ADD CONSTRAINT "VideoFrameMatch_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrameMatch" ADD CONSTRAINT "VideoFrameMatch_videoFrameId_fkey" FOREIGN KEY ("videoFrameId") REFERENCES "VideoFrame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

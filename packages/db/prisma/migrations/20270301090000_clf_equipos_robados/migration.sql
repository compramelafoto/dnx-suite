-- CreateEnum
CREATE TYPE "GearSerialKind" AS ENUM ('BODY', 'LENS');

-- CreateEnum
CREATE TYPE "StolenGearReportStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'RECOVERED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "StolenGearMatchStatus" AS ENUM ('NEW', 'REVIEWING', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "GearSerialSighting" (
    "id" SERIAL NOT NULL,
    "kind" "GearSerialKind" NOT NULL,
    "serialNormalized" TEXT NOT NULL,
    "serialRaw" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "photographerId" INTEGER,
    "photographerLabel" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastUploadedAt" TIMESTAMP(3) NOT NULL,
    "photosCount" INTEGER NOT NULL DEFAULT 0,
    "lastAlbumId" INTEGER,
    "lastAlbumTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearSerialSighting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StolenGearReport" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "kind" "GearSerialKind" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialRaw" TEXT NOT NULL,
    "serialNormalized" TEXT NOT NULL,
    "stolenAt" TIMESTAMP(3) NOT NULL,
    "stolenPlace" TEXT,
    "description" TEXT,
    "policeReportNumber" TEXT,
    "invoiceKey" TEXT NOT NULL,
    "invoiceMime" TEXT NOT NULL,
    "policeReportKey" TEXT,
    "policeReportMime" TEXT,
    "status" "StolenGearReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "recoveredAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StolenGearReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StolenGearMatch" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "sightingId" INTEGER NOT NULL,
    "makeMismatch" BOOLEAN NOT NULL DEFAULT false,
    "status" "StolenGearMatchStatus" NOT NULL DEFAULT 'NEW',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StolenGearMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GearSerialSighting_serialNormalized_idx" ON "GearSerialSighting"("serialNormalized");

-- CreateIndex
CREATE INDEX "GearSerialSighting_photographerId_idx" ON "GearSerialSighting"("photographerId");

-- CreateIndex
CREATE INDEX "GearSerialSighting_lastSeenAt_idx" ON "GearSerialSighting"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "GearSerialSighting_kind_serialNormalized_photographerId_key" ON "GearSerialSighting"("kind", "serialNormalized", "photographerId");

-- CreateIndex
CREATE INDEX "StolenGearReport_reporterId_idx" ON "StolenGearReport"("reporterId");

-- CreateIndex
CREATE INDEX "StolenGearReport_status_idx" ON "StolenGearReport"("status");

-- CreateIndex
CREATE INDEX "StolenGearReport_serialNormalized_idx" ON "StolenGearReport"("serialNormalized");

-- CreateIndex
CREATE INDEX "StolenGearMatch_status_idx" ON "StolenGearMatch"("status");

-- CreateIndex
CREATE INDEX "StolenGearMatch_notifiedAt_idx" ON "StolenGearMatch"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StolenGearMatch_reportId_sightingId_key" ON "StolenGearMatch"("reportId", "sightingId");

-- AddForeignKey
ALTER TABLE "GearSerialSighting" ADD CONSTRAINT "GearSerialSighting_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StolenGearReport" ADD CONSTRAINT "StolenGearReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StolenGearReport" ADD CONSTRAINT "StolenGearReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StolenGearMatch" ADD CONSTRAINT "StolenGearMatch_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StolenGearReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StolenGearMatch" ADD CONSTRAINT "StolenGearMatch_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "GearSerialSighting"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Carga inicial del historial de números de serie ─────────────────────────
-- Normalización (igual que lib/stolen-gear/serial.ts): mayúsculas, sólo letras
-- y números, sin ceros a la izquierda. Se descartan series de menos de 4 caracteres.

-- Cámaras: desde PhotographicCameraBody (sobrevive a la limpieza de álbumes).
INSERT INTO "GearSerialSighting" (
  "kind", "serialNormalized", "serialRaw", "make", "model", "photographerId", "photographerLabel",
  "firstSeenAt", "lastSeenAt", "lastUploadedAt", "photosCount", "lastAlbumId", "lastAlbumTitle", "updatedAt"
)
SELECT DISTINCT ON (b.norm, b."photographerId")
  'BODY'::"GearSerialKind", b.norm, b."serialNumber", b."makeRaw", b."modelRaw", b."photographerId",
  COALESCE(NULLIF(u."name", ''), u."email"),
  MIN(b."firstSeenAt") OVER w, MAX(b."lastSeenAt") OVER w,
  GREATEST(MAX(b."lastSeenAt") OVER w, COALESCE(MAX(o.last_upload) OVER w, MAX(b."lastSeenAt") OVER w)),
  SUM(b."photosCount") OVER w,
  o.last_album_id, a."title", CURRENT_TIMESTAMP
FROM (
  SELECT cb.*, ltrim(regexp_replace(upper(cb."serialNumber"), '[^A-Z0-9]', '', 'g'), '0') AS norm
  FROM "PhotographicCameraBody" cb
  WHERE cb."serialNumber" IS NOT NULL
) b
JOIN "User" u ON u."id" = b."photographerId"
LEFT JOIN LATERAL (
  SELECT MAX(ob."uploadedAt") AS last_upload,
         (ARRAY_AGG(ob."albumId" ORDER BY ob."uploadedAt" DESC))[1] AS last_album_id
  FROM "PhotographicGearObservation" ob WHERE ob."cameraBodyId" = b."id"
) o ON TRUE
LEFT JOIN "Album" a ON a."id" = o.last_album_id
WHERE length(b.norm) >= 4
WINDOW w AS (PARTITION BY b.norm, b."photographerId")
ORDER BY b.norm, b."photographerId", b."photosCount" DESC
ON CONFLICT ("kind", "serialNormalized", "photographerId") DO NOTHING;

-- Lentes: el número de serie sólo está en rawExifSummary de las fotos que siguen vivas.
INSERT INTO "GearSerialSighting" (
  "kind", "serialNormalized", "serialRaw", "make", "model", "photographerId", "photographerLabel",
  "firstSeenAt", "lastSeenAt", "lastUploadedAt", "photosCount", "lastAlbumId", "lastAlbumTitle", "updatedAt"
)
SELECT
  'LENS'::"GearSerialKind", x.norm,
  (ARRAY_AGG(x.raw ORDER BY x."uploadedAt" DESC))[1],
  COALESCE((ARRAY_AGG(l."makeRaw" ORDER BY x."uploadedAt" DESC) FILTER (WHERE l."makeRaw" IS NOT NULL))[1], 'Desconocido'),
  COALESCE((ARRAY_AGG(l."modelRaw" ORDER BY x."uploadedAt" DESC) FILTER (WHERE l."modelRaw" IS NOT NULL))[1], 'Desconocido'),
  x."photographerId",
  MIN(COALESCE(NULLIF(u."name", ''), u."email")),
  MIN(COALESCE(x."takenAt", x."uploadedAt")), MAX(COALESCE(x."takenAt", x."uploadedAt")), MAX(x."uploadedAt"),
  COUNT(*)::int,
  (ARRAY_AGG(x."albumId" ORDER BY x."uploadedAt" DESC))[1],
  (ARRAY_AGG(a."title" ORDER BY x."uploadedAt" DESC))[1],
  CURRENT_TIMESTAMP
FROM (
  SELECT ob.*, ob."rawExifSummary"->>'LensSerialNumber' AS raw,
         ltrim(regexp_replace(upper(ob."rawExifSummary"->>'LensSerialNumber'), '[^A-Z0-9]', '', 'g'), '0') AS norm
  FROM "PhotographicGearObservation" ob
  WHERE ob."rawExifSummary" ? 'LensSerialNumber'
) x
JOIN "User" u ON u."id" = x."photographerId"
LEFT JOIN "PhotographicLens" l ON l."id" = x."lensId"
LEFT JOIN "Album" a ON a."id" = x."albumId"
WHERE length(x.norm) >= 4
GROUP BY x.norm, x."photographerId"
ON CONFLICT ("kind", "serialNormalized", "photographerId") DO NOTHING;

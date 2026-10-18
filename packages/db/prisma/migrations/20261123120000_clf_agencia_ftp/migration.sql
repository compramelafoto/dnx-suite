-- Modo agencia de CompraMeLaFoto (etapa 2b): usuario de FTP por fotógrafo del equipo y "Estoy acá".
-- Crea AgencyUploadCredential y AgencyMemberPresence y agrega tres columnas opcionales a "CameraIngestJob".
-- No toca filas existentes. Schema compartido: se aplica a mano en las cinco bases ANTES del deploy y se
-- registra con el checksum del archivo.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyUploadCredential" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "ftpUsername" TEXT NOT NULL,
    "ftpPasswordHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyUploadCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyMemberPresence" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "placeId" INTEGER,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyMemberPresence_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "declaredLat" DOUBLE PRECISION;
ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "declaredLng" DOUBLE PRECISION;
ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "agencyCredentialId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyUploadCredential_ftpUsername_key" ON "AgencyUploadCredential"("ftpUsername");
CREATE INDEX IF NOT EXISTS "AgencyUploadCredential_memberId_idx" ON "AgencyUploadCredential"("memberId");
CREATE INDEX IF NOT EXISTS "AgencyUploadCredential_agencyId_idx" ON "AgencyUploadCredential"("agencyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyMemberPresence_memberId_key" ON "AgencyMemberPresence"("memberId");

-- AddForeignKey
ALTER TABLE "AgencyUploadCredential" ADD CONSTRAINT "AgencyUploadCredential_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyUploadCredential" ADD CONSTRAINT "AgencyUploadCredential_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyUploadCredential" ADD CONSTRAINT "AgencyUploadCredential_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMemberPresence" ADD CONSTRAINT "AgencyMemberPresence_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

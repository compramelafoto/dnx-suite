-- Modo agencia de CompraMeLaFoto (etapa 1): crea Agency, AgencyMember, AgencyInvite, AgencyAlbum y
-- AgencyPlace. Sólo crea tablas nuevas: no toca ninguna existente, no borra ni actualiza filas. El schema es
-- compartido: se aplica a mano en las cinco bases (sólo CLF la usa) y se registra con el checksum del archivo.

-- CreateTable
CREATE TABLE "Agency" (
    "id" SERIAL NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 3000,
    "directoryListed" BOOLEAN NOT NULL DEFAULT false,
    "directoryLat" DOUBLE PRECISION,
    "directoryLng" DOUBLE PRECISION,
    "directoryRadiusKm" INTEGER NOT NULL DEFAULT 50,
    "directoryCity" TEXT,
    "notFoundSearchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishMode" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "photoVisibilityDays" INTEGER NOT NULL DEFAULT 30,
    "termsText" TEXT,
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Agency_defaultCommissionBps_check" CHECK ("defaultCommissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "Agency_publishMode_check" CHECK ("publishMode" IN ('IMMEDIATE','AWAIT_FILTER'))
);

-- CreateTable
CREATE TABLE "AgencyMember" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "commissionBps" INTEGER,
    "termsVersionAccepted" INTEGER,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsAcceptedText" TEXT,
    "requestMessage" TEXT,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgencyMember_status_check" CHECK ("status" IN ('REQUESTED','ACTIVE','REJECTED','REMOVED')),
    CONSTRAINT "AgencyMember_commissionBps_check" CHECK ("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 10000)
);

-- CreateTable
CREATE TABLE "AgencyInvite" (
    "id" TEXT NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAlbum" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyPlace" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_ownerUserId_key" ON "Agency"("ownerUserId");
CREATE INDEX "Agency_directoryListed_idx" ON "Agency"("directoryListed");
CREATE UNIQUE INDEX "AgencyMember_agencyId_userId_key" ON "AgencyMember"("agencyId", "userId");
CREATE INDEX "AgencyMember_userId_idx" ON "AgencyMember"("userId");
CREATE UNIQUE INDEX "AgencyInvite_tokenHash_key" ON "AgencyInvite"("tokenHash");
CREATE INDEX "AgencyInvite_agencyId_idx" ON "AgencyInvite"("agencyId");
CREATE UNIQUE INDEX "AgencyAlbum_albumId_key" ON "AgencyAlbum"("albumId");
CREATE INDEX "AgencyAlbum_agencyId_idx" ON "AgencyAlbum"("agencyId");
CREATE INDEX "AgencyPlace_agencyId_idx" ON "AgencyPlace"("agencyId");

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyInvite" ADD CONSTRAINT "AgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyAlbum" ADD CONSTRAINT "AgencyAlbum_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyAlbum" ADD CONSTRAINT "AgencyAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyPlace" ADD CONSTRAINT "AgencyPlace_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

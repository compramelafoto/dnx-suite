-- Clickatón: Clickatoner de la semana (diseño 2026-10-05). Sólo crea tablas nuevas, sin tocar datos.
-- Se aplica a mano en la base de Clickatón (bitter-math-56019731) y después:
--   npx prisma migrate resolve --applied 20261006120000_clickaton_clickatoner_de_la_semana

-- CreateTable
CREATE TABLE "ClickatonEditionResultsPublication" (
    "editionId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" INTEGER,

    CONSTRAINT "ClickatonEditionResultsPublication_pkey" PRIMARY KEY ("editionId")
);

-- CreateTable
CREATE TABLE "ClickatonClickatonerOptOut" (
    "email" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickatonClickatonerOptOut_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "ClickatonPublicProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickatonPublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonClickatoner" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "round" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "submissionId" TEXT,
    "skippedAt" TIMESTAMP(3),
    "skippedByUserId" INTEGER,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickatonClickatoner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonPublicProfile_email_key" ON "ClickatonPublicProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonPublicProfile_slug_key" ON "ClickatonPublicProfile"("slug");

-- CreateIndex
CREATE INDEX "ClickatonClickatoner_weekStart_idx" ON "ClickatonClickatoner"("weekStart");

-- CreateIndex
CREATE INDEX "ClickatonClickatoner_round_idx" ON "ClickatonClickatoner"("round");


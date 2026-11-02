-- AlterTable
ALTER TABLE "FotofficeEvento" ADD COLUMN     "acreditacionHabilitada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inscripcionPublica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pideFoto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "placaTemplateId" TEXT,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "FotofficeEventoInscripto" ADD COLUMN     "acreditacionClave" TEXT,
ADD COLUMN     "acreditadoFuente" TEXT,
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "consentimientos" JSONB,
ADD COLUMN     "datosCompletosAt" TIMESTAMP(3),
ADD COLUMN     "enlaceEnviadoAt" TIMESTAMP(3),
ADD COLUMN     "fotoKey" TEXT,
ADD COLUMN     "fotoUrl" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "qrTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEvento_workspaceId_slug_key" ON "FotofficeEvento"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEventoInscripto_acreditacionClave_key" ON "FotofficeEventoInscripto"("acreditacionClave");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEventoInscripto_qrTokenHash_key" ON "FotofficeEventoInscripto"("qrTokenHash");

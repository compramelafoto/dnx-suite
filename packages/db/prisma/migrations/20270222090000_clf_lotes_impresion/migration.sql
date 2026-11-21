-- CreateEnum
CREATE TYPE "PrintBatchEstado" AS ENUM ('ARMADO', 'ENVIADO', 'EN_PRODUCCION', 'LISTO', 'DESPACHADO', 'RECIBIDO', 'CERRADO', 'ANULADO');
-- CreateEnum
CREATE TYPE "PrintBatchTipo" AS ENUM ('COMUNES', 'ESCOLAR');
-- CreateEnum
CREATE TYPE "PrintBatchEntrega" AS ENUM ('RETIRA_FOTOGRAFO', 'ENVIA_LAB');
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupLabContactId" INTEGER;
-- CreateTable
CREATE TABLE "PhotographerLabContact" (
    "id" SERIAL NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "labId" INTEGER,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "notas" TEXT,
    "esPredeterminado" BOOLEAN NOT NULL DEFAULT false,
    "puntoDeRetiro" BOOLEAN NOT NULL DEFAULT false,
    "direccion" TEXT,
    "horario" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotographerLabContact_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PrintBatch" (
    "id" SERIAL NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "labContactId" INTEGER,
    "labId" INTEGER,
    "nombre" TEXT NOT NULL,
    "tipo" "PrintBatchTipo" NOT NULL DEFAULT 'COMUNES',
    "estado" "PrintBatchEstado" NOT NULL DEFAULT 'ARMADO',
    "mensajeAlLab" TEXT,
    "entregaPreferida" "PrintBatchEntrega" NOT NULL DEFAULT 'RETIRA_FOTOGRAFO',
    "fechaPrometida" TIMESTAMP(3),
    "tokenHash" TEXT,
    "enviadoAt" TIMESTAMP(3),
    "labAbrioAt" TIMESTAMP(3),
    "labDescargoAt" TIMESTAMP(3),
    "enProduccionAt" TIMESTAMP(3),
    "listoAt" TIMESTAMP(3),
    "despachadoAt" TIMESTAMP(3),
    "recibidoAt" TIMESTAMP(3),
    "cerradoAt" TIMESTAMP(3),
    "pagadoAlLabAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrintBatch_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PrintBatchEntry" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "albumOrderId" INTEGER,
    "printOrderId" INTEGER,
    "designProjectId" INTEGER,
    "schoolCopiesJobId" INTEGER,
    "retiraCliente" BOOLEAN NOT NULL DEFAULT false,
    "pickupLabContactId" INTEGER,
    "resumen" JSONB NOT NULL,
    "quitadoAt" TIMESTAMP(3),
    "entregadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintBatchEntry_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PhotographerLabContact_labId_idx" ON "PhotographerLabContact"("labId");
-- CreateIndex
CREATE UNIQUE INDEX "PhotographerLabContact_photographerId_email_key" ON "PhotographerLabContact"("photographerId", "email");
-- CreateIndex
CREATE UNIQUE INDEX "PrintBatch_tokenHash_key" ON "PrintBatch"("tokenHash");
-- CreateIndex
CREATE INDEX "PrintBatch_photographerId_estado_idx" ON "PrintBatch"("photographerId", "estado");
-- CreateIndex
CREATE INDEX "PrintBatchEntry_batchId_idx" ON "PrintBatchEntry"("batchId");
-- CreateIndex
CREATE INDEX "PrintBatchEntry_albumOrderId_idx" ON "PrintBatchEntry"("albumOrderId");
-- CreateIndex
CREATE INDEX "PrintBatchEntry_printOrderId_idx" ON "PrintBatchEntry"("printOrderId");
-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupLabContactId_fkey" FOREIGN KEY ("pickupLabContactId") REFERENCES "PhotographerLabContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PhotographerLabContact" ADD CONSTRAINT "PhotographerLabContact_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PhotographerLabContact" ADD CONSTRAINT "PhotographerLabContact_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrintBatch" ADD CONSTRAINT "PrintBatch_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrintBatch" ADD CONSTRAINT "PrintBatch_labContactId_fkey" FOREIGN KEY ("labContactId") REFERENCES "PhotographerLabContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrintBatch" ADD CONSTRAINT "PrintBatch_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrintBatchEntry" ADD CONSTRAINT "PrintBatchEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PrintBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrintBatchEntry" ADD CONSTRAINT "PrintBatchEntry_albumOrderId_fkey" FOREIGN KEY ("albumOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PrintBatchEntry" ADD CONSTRAINT "PrintBatchEntry_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un pedido de álbum no puede estar en dos lotes vivos a la vez (índice único parcial; sólo existe en SQL).
CREATE UNIQUE INDEX "PrintBatchEntry_albumOrder_vivo" ON "PrintBatchEntry" ("albumOrderId")
  WHERE "albumOrderId" IS NOT NULL AND "quitadoAt" IS NULL;

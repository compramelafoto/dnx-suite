-- Campaña de correo de DNX Estudio a colegios: crea `SchoolOutreachProspect` (una fila por administración escolar,
-- con estado de envío, id del proveedor y última acción). Sólo crea una tabla nueva: no toca ninguna existente,
-- no borra ni actualiza filas. Se aplica a mano sólo en la base de CompraMeLaFoto (es la única que la usa) y se
-- registra con el checksum del archivo.

-- CreateTable
CREATE TABLE "SchoolOutreachProspect" (
    "id" SERIAL NOT NULL,
    "campaignKey" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "levels" TEXT,
    "sourceIds" TEXT[],
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
    "clfSchoolId" INTEGER,
    "clfCheckedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastAction" TEXT,
    "lastActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolOutreachProspect_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolOutreachProspect_status_check" CHECK ("status" IN ('PENDIENTE_VALIDACION','LISTO','ENVIANDO','ENVIADO','FALLIDO','REBOTADO','RESPONDIO','NO_CONTACTAR'))
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolOutreachProspect_campaignKey_groupKey_key" ON "SchoolOutreachProspect"("campaignKey", "groupKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolOutreachProspect_campaignKey_email_key" ON "SchoolOutreachProspect"("campaignKey", "email");

-- CreateIndex
CREATE INDEX "SchoolOutreachProspect_email_idx" ON "SchoolOutreachProspect"("email");

-- CreateIndex
CREATE INDEX "SchoolOutreachProspect_status_idx" ON "SchoolOutreachProspect"("status");

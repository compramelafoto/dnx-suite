-- Carnet de socio.
--
-- No hay columna "habilitado" a propósito: se calcula en cada consulta a partir de la
-- condición del socio, la vigencia, la revocación y la mora. Guardarla volvería a mezclar
-- condición institucional con situación financiera.

CREATE TYPE "MemberCardFormat" AS ENUM ('DIGITAL', 'PRINTED');

CREATE TABLE "MemberCard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "format" "MemberCardFormat" NOT NULL DEFAULT 'DIGITAL',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "revokedByUserId" INTEGER,
    "designTemplateVersionId" TEXT,
    "rendererVersion" TEXT,
    "designSchemaVersion" INTEGER,
    "files" JSONB,
    "printOrderChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCard_pkey" PRIMARY KEY ("id")
);

-- El token se busca por su hash en cada escaneo: sin este índice único, cada lectura del QR
-- sería un recorrido completo de la tabla.
CREATE UNIQUE INDEX "MemberCard_tokenHash_key" ON "MemberCard"("tokenHash");

CREATE UNIQUE INDEX "MemberCard_workspaceId_cardNumber_key" ON "MemberCard"("workspaceId", "cardNumber");

CREATE INDEX "MemberCard_memberId_issuedAt_idx" ON "MemberCard"("memberId", "issuedAt");

CREATE INDEX "MemberCard_workspaceId_validUntil_idx" ON "MemberCard"("workspaceId", "validUntil");

ALTER TABLE "MemberCard" ADD CONSTRAINT "MemberCard_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT y no CASCADE: borrar un socio no puede llevarse por delante la evidencia de qué
-- carnets se le emitieron.
ALTER TABLE "MemberCard" ADD CONSTRAINT "MemberCard_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

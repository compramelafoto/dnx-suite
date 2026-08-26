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

-- ---------------------------------------------------------------------------
-- Trazabilidad del carnet físico.
--
-- A diferencia de "habilitado", que se calcula, esto se guarda: cada paso lo causó una
-- persona, y por lo tanto es un hecho con fecha y responsable.
-- ---------------------------------------------------------------------------

CREATE TYPE "MemberCardFulfillmentState" AS ENUM (
    'PENDIENTE_PAGO', 'EN_COLA', 'IMPRESO', 'LISTO_PARA_RETIRAR', 'ENVIADO', 'ENTREGADO', 'ANULADO'
);

-- Solo aplica a los carnets impresos: el digital no se imprime ni se entrega.
ALTER TABLE "MemberCard" ADD COLUMN "fulfillmentState" "MemberCardFulfillmentState";
ALTER TABLE "MemberCard" ADD COLUMN "fulfillmentUpdatedAt" TIMESTAMP(3);

CREATE INDEX "MemberCard_workspaceId_fulfillmentState_idx"
    ON "MemberCard"("workspaceId", "fulfillmentState");

-- El estado actual vive en MemberCard para poder filtrar sin recorrer el historial, pero la
-- verdad de qué pasó está acá.
CREATE TABLE "MemberCardEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "fromState" "MemberCardFulfillmentState",
    "toState" "MemberCardFulfillmentState" NOT NULL,
    "actorUserId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCardEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberCardEvent_cardId_createdAt_idx" ON "MemberCardEvent"("cardId", "createdAt");

ALTER TABLE "MemberCardEvent" ADD CONSTRAINT "MemberCardEvent_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "MemberCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quién puede operar los carnets, además del dueño y los administradores. Existe para el
-- caso que lo motivó: el impresor entra, marca como impreso, y no puede hacer nada más.
CREATE TABLE "MemberCardOperator" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "canProduce" BOOLEAN NOT NULL DEFAULT false,
    "canDeliver" BOOLEAN NOT NULL DEFAULT false,
    "grantedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCardOperator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberCardOperator_workspaceId_userId_key"
    ON "MemberCardOperator"("workspaceId", "userId");

CREATE INDEX "MemberCardOperator_workspaceId_idx" ON "MemberCardOperator"("workspaceId");

ALTER TABLE "MemberCardOperator" ADD CONSTRAINT "MemberCardOperator_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberCardOperator" ADD CONSTRAINT "MemberCardOperator_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El aviso al socio sale DESPUÉS de confirmar el cambio de estado: el carnet se imprimió,
-- eso ya es cierto, y un aviso que no sale no puede deshacerlo. Queda registrado para que la
-- Secretaría lo vea y reintente.
ALTER TABLE "MemberCardEvent" ADD COLUMN "noticeSentAt" TIMESTAMP(3);
ALTER TABLE "MemberCardEvent" ADD COLUMN "noticeError" TEXT;

-- Nombre del actor al momento del evento, con el mismo criterio que MemberAudit: la historia
-- tiene que seguir entendiéndose aunque esa persona cambie de nombre o se elimine.
ALTER TABLE "MemberCardEvent" ADD COLUMN "actorLabel" TEXT;

-- El token, además de hasheado para buscar, se guarda cifrado para poder mostrarle al socio
-- su propio QR. Una contraseña nunca se muestra de vuelta; un código QR sí.
ALTER TABLE "MemberCard" ADD COLUMN "tokenCiphertext" TEXT;
ALTER TABLE "MemberCard" ADD COLUMN "tokenNonce" TEXT;
ALTER TABLE "MemberCard" ADD COLUMN "tokenAuthTag" TEXT;

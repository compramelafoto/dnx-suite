-- Reconciliación del dominio base Member/MemberCategory (módulo institucional
-- `members`, todavía PLANNED en MODULE_REGISTRY).
--
-- Este SQL fue aplicado manualmente contra la base de staging dentro
-- de una transacción explícita con verificación programática antes del
-- COMMIT. Este archivo documenta exactamente lo que se ejecutó, para que:
--   (a) un entorno nuevo que corra `prisma migrate deploy` desde cero
--       reproduzca la misma estructura;
--   (b) el historial de Prisma (`_prisma_migrations`) pueda marcarse como
--       aplicado sin volver a ejecutar el ALTER (ver informe de la etapa).
--
-- NO reproducir este archivo con `prisma migrate deploy` sobre staging:
-- ya fue aplicado a mano, y el historial de Prisma ya fue marcado como
-- aplicado vía `prisma migrate resolve --applied` sobre ese mismo entorno.

-- 1) MemberStatus: ACTIVE/OVERDUE/SUSPENDED/CANCELLED -> ACTIVE/SUSPENDED/INACTIVE
ALTER TABLE "Member" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Member" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
DROP TYPE "MemberStatus";
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
ALTER TABLE "Member" ALTER COLUMN "status" TYPE "MemberStatus" USING "status"::"MemberStatus";
ALTER TABLE "Member" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- 2) MemberCategory: sacar acoplamiento a precio/cuota/carnet, agregar order
ALTER TABLE "MemberCategory" DROP CONSTRAINT IF EXISTS "MemberCategory_cardTemplateId_fkey";
DROP INDEX IF EXISTS "MemberCategory_workspaceId_cardTemplateId_idx";
ALTER TABLE "MemberCategory"
  DROP COLUMN IF EXISTS "monthlyAmountCents",
  DROP COLUMN IF EXISTS "enrollmentFeeCents",
  DROP COLUMN IF EXISTS "enrollmentCoversMonths",
  DROP COLUMN IF EXISTS "billingDay",
  DROP COLUMN IF EXISTS "cardTemplateId";
ALTER TABLE "MemberCategory" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "MemberCategory_workspaceId_order_idx" ON "MemberCategory"("workspaceId", "order");

-- 3) Member: sacar fullName/publicToken, conservar la foto como avatarUrl,
--    aflojar email, agregar birthDate/postalCode/leftAt/userId
DROP INDEX IF EXISTS "Member_workspaceId_fullName_idx";
DROP INDEX IF EXISTS "Member_workspaceId_publicToken_idx";
ALTER TABLE "Member" DROP CONSTRAINT IF EXISTS "Member_publicToken_key";
ALTER TABLE "Member"
  DROP COLUMN IF EXISTS "fullName",
  DROP COLUMN IF EXISTS "publicToken";
ALTER TABLE "Member" RENAME COLUMN "profileImageUrl" TO "avatarUrl";
ALTER TABLE "Member" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Member"
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "leftAt" TIMESTAMP(3),
  ADD COLUMN "userId" INTEGER;
CREATE UNIQUE INDEX "Member_workspaceId_userId_key" ON "Member"("workspaceId", "userId");
CREATE UNIQUE INDEX "Member_workspaceId_documentType_documentNumber_key"
  ON "Member"("workspaceId", "documentType", "documentNumber");
CREATE INDEX "Member_workspaceId_lastName_firstName_idx" ON "Member"("workspaceId", "lastName", "firstName");
ALTER TABLE "Member"
  ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- NO tocado a propósito: MembershipFee, MemberCharge, MemberPayment,
-- MemberCard, CardTemplate, CardRequest, MemberCardIssued.

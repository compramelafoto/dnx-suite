-- DNX Bot etapa 3 (compradores), fase A: sólo agrega. Idempotente. Se aplica ANTES del deploy.
-- Todo en una transacción. lock_timeout: si una transacción larga tiene tomada una tabla (p. ej. "Order"),
-- falla a los 5 s en vez de dejar en cola los checkouts; en ese caso, reintentar.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  CREATE TYPE "BotAudience" AS ENUM ('PHOTOGRAPHER', 'BUYER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "audience" "BotAudience" NOT NULL DEFAULT 'PHOTOGRAPHER';
ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "guestKey" TEXT;
ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "ipHash" TEXT;
ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "buyerEmail" TEXT;
ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "verifiedUntil" TIMESTAMP(3);
ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "albumId" INTEGER;
ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;
CREATE INDEX IF NOT EXISTS "BotConversation_audience_guestKey_updatedAt_idx" ON "BotConversation"("audience", "guestKey", "updatedAt");
CREATE INDEX IF NOT EXISTS "BotConversation_audience_createdAt_idx" ON "BotConversation"("audience", "createdAt");

ALTER TABLE "BotAction" ALTER COLUMN "userId" DROP NOT NULL;

-- actorKey: se agrega nullable y se completa; el índice viejo (platform, day, userId) se conserva
-- hasta la fase B para que el código anterior siga funcionando mientras sale el deploy.
ALTER TABLE "BotUsageDaily" ADD COLUMN IF NOT EXISTS "actorKey" TEXT;

-- Ventana del deploy: el código anterior crea filas sin actorKey. Este trigger las completa con
-- 'u:' || userId para que el código nuevo (upsert por actorKey) las encuentre y no choque con el
-- índice viejo (platform, day, userId). Se crea ANTES del backfill: CREATE TRIGGER espera a que
-- terminen las inserciones en curso, así que el UPDATE de abajo cubre todo lo anterior y el trigger
-- todo lo posterior (ninguna fila queda con actorKey nulo). Se borra en la fase B.
CREATE OR REPLACE FUNCTION "BotUsageDaily_fill_actorKey"() RETURNS trigger AS $$
BEGIN
  IF NEW."actorKey" IS NULL AND NEW."userId" IS NOT NULL THEN
    NEW."actorKey" := 'u:' || NEW."userId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "BotUsageDaily_fill_actorKey" ON "BotUsageDaily";
CREATE TRIGGER "BotUsageDaily_fill_actorKey" BEFORE INSERT ON "BotUsageDaily"
  FOR EACH ROW EXECUTE FUNCTION "BotUsageDaily_fill_actorKey"();

UPDATE "BotUsageDaily" SET "actorKey" = 'u:' || "userId" WHERE "actorKey" IS NULL AND "userId" IS NOT NULL;
ALTER TABLE "BotUsageDaily" ALTER COLUMN "userId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "BotUsageDaily_platform_day_actorKey_key" ON "BotUsageDaily"("platform", "day", "actorKey");

CREATE TABLE IF NOT EXISTS "BotEmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotEmailCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BotEmailCode_email_createdAt_idx" ON "BotEmailCode"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "BotEmailCode_ipHash_createdAt_idx" ON "BotEmailCode"("ipHash", "createdAt");
CREATE INDEX IF NOT EXISTS "BotEmailCode_conversationId_createdAt_idx" ON "BotEmailCode"("conversationId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "BotEmailCode" ADD CONSTRAINT "BotEmailCode_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;
CREATE INDEX IF NOT EXISTS "SupportTicket_orderId_idx" ON "SupportTicket"("orderId");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "botGuestKey" TEXT;

COMMIT;

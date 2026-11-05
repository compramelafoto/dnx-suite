-- CLF internacional, etapa 2: cuenta de cobro propia del fotógrafo.
-- Cambio solo aditivo: crea una tabla nueva. Se puede repetir sin efectos.
CREATE TABLE IF NOT EXISTS "ClfIntlCollectionAccount" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "secretLast4" TEXT NOT NULL,
  "accountId" TEXT,
  "accountLabel" TEXT,
  "accountCountryCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClfIntlCollectionAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClfIntlCollectionAccount_userId_status_idx"
  ON "ClfIntlCollectionAccount"("userId", "status");

-- Un fotógrafo solo puede tener una cuenta de cobro activa a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS "ClfIntlCollectionAccount_one_active_per_user"
  ON "ClfIntlCollectionAccount"("userId") WHERE "status" = 'ACTIVE';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClfIntlCollectionAccount_userId_fkey'
  ) THEN
    ALTER TABLE "ClfIntlCollectionAccount"
      ADD CONSTRAINT "ClfIntlCollectionAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CLF: apps de la suite autorizadas por el fotógrafo a leer sus ventas (conexión con FOTOFFICE, etapa 2).
-- Sólo en la base de CLF (rama Neon production).
CREATE TABLE "ClfAppConnection" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "appKey" TEXT NOT NULL,
    "externalLabel" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ClfAppConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClfAppConnection_keyHash_key" ON "ClfAppConnection"("keyHash");
CREATE INDEX "ClfAppConnection_userId_revokedAt_idx" ON "ClfAppConnection"("userId", "revokedAt");
ALTER TABLE "ClfAppConnection" ADD CONSTRAINT "ClfAppConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClfAppConnectCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "appKey" TEXT NOT NULL,
    "externalLabel" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClfAppConnectCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClfAppConnectCode_codeHash_key" ON "ClfAppConnectCode"("codeHash");
CREATE INDEX "ClfAppConnectCode_expiresAt_idx" ON "ClfAppConnectCode"("expiresAt");
ALTER TABLE "ClfAppConnectCode" ADD CONSTRAINT "ClfAppConnectCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

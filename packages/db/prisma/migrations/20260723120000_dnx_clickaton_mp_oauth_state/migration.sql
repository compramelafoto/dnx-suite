-- Clickatón Mercado Pago OAuth state (10D3I-I1). Additive only.
-- Does not alter User.mp* / Lab.mp* / CLF MercadoPagoOAuthState.

CREATE TABLE IF NOT EXISTS "DnxMercadoPagoOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "financialIdentityId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "environment" "DnxFinancialEnvironment" NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT,
    "codeVerifierCiphertext" TEXT,
    "codeVerifierNonce" TEXT,
    "codeVerifierAuthTag" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxMercadoPagoOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxMercadoPagoOAuthState_stateHash_key" ON "DnxMercadoPagoOAuthState"("stateHash");
CREATE INDEX IF NOT EXISTS "DnxMercadoPagoOAuthState_userId_productKey_idx" ON "DnxMercadoPagoOAuthState"("userId", "productKey");
CREATE INDEX IF NOT EXISTS "DnxMercadoPagoOAuthState_financialIdentityId_idx" ON "DnxMercadoPagoOAuthState"("financialIdentityId");
CREATE INDEX IF NOT EXISTS "DnxMercadoPagoOAuthState_expiresAt_idx" ON "DnxMercadoPagoOAuthState"("expiresAt");
CREATE INDEX IF NOT EXISTS "DnxMercadoPagoOAuthState_purpose_environment_idx" ON "DnxMercadoPagoOAuthState"("purpose", "environment");

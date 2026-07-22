-- 10D3I-D — Encrypted credentials + legacy MP migration fields.
-- Additive only. Does NOT mutate User.mp* / Lab.mp*.
-- Do NOT apply to Production. Do NOT apply to ambiguous Neon hosts.

CREATE TABLE "DnxEncryptedCredential" (
    "id" TEXT NOT NULL,
    "provider" "DnxPaymentProvider" NOT NULL,
    "environment" "DnxFinancialEnvironment" NOT NULL,
    "purpose" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DnxEncryptedCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxEncryptedCredential_provider_environment_purpose_idx"
  ON "DnxEncryptedCredential"("provider", "environment", "purpose");
CREATE INDEX "DnxEncryptedCredential_revokedAt_idx"
  ON "DnxEncryptedCredential"("revokedAt");

ALTER TABLE "DnxFinancialIdentity"
  ADD COLUMN "organizationRef" TEXT;

CREATE UNIQUE INDEX "DnxFinancialIdentity_organizationRef_key"
  ON "DnxFinancialIdentity"("organizationRef");

ALTER TABLE "DnxPaymentAccount"
  ADD COLUMN "legacySource" TEXT,
  ADD COLUMN "tokenFingerprint" TEXT,
  ADD COLUMN "connectedAt" TIMESTAMP(3);

CREATE INDEX "DnxPaymentAccount_tokenFingerprint_idx"
  ON "DnxPaymentAccount"("tokenFingerprint");
CREATE INDEX "DnxPaymentAccount_legacySource_idx"
  ON "DnxPaymentAccount"("legacySource");

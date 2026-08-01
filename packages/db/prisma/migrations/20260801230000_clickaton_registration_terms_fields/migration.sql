-- Campos de bases/consentimiento extendido en inscripción (10F.0).
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "promotionalLicenseAcceptedAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "identifiablePersonsDeclaredAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "identifiablePersonsPolicyVersion" TEXT;

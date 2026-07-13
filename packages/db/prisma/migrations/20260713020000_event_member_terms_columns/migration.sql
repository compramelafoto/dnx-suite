-- EventMember terms acceptance (join flow)
ALTER TABLE "EventMember" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "EventMember" ADD COLUMN IF NOT EXISTS "termsAcceptedText" TEXT;

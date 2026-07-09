-- CLF User gap columns (monorepo schema vs applied migrations)
-- Staging Neon is missing User columns that Prisma Client expects after
-- legacy merges (Cuánto Cobro + shared cleanup). Missing columns cause
-- P2022 on prisma.user.findUnique / upsert during login and seed.
-- Forward-only, additive, safe defaults. Do NOT apply to production yet.

-- Cuánto Cobro identity flags
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cuantoCobroUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cuantoCobroFirstSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cuantoCobroLastSeenAt" TIMESTAMP(3);

-- Photographer coverage radius (null = no limit)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workingCoverageRadiusKm" INTEGER;

-- Organizer payout destination (manual transfer)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutAlias" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutBank" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutAccountHolder" TEXT;

-- Admin: show buyer data on unpaid photographer orders
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allowUnpaidOrderClientData" BOOLEAN NOT NULL DEFAULT false;

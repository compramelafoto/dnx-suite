-- Etapa 09B1: resumen público de inscripción (aditivo).
-- Defaults conservadores: registrationEnabled=false; sin convertir eventos a pagos.
-- Sin órdenes, pagos, stock ni collectors.

CREATE TYPE "FotorankRegistrationPricingMode" AS ENUM ('FREE', 'PAID');

ALTER TABLE "FotorankContest"
ADD COLUMN "registrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "registrationPricingMode" "FotorankRegistrationPricingMode",
ADD COLUMN "registrationPriceAmountMinor" INTEGER,
ADD COLUMN "registrationCurrency" TEXT,
ADD COLUMN "registrationOpensAt" TIMESTAMP(3),
ADD COLUMN "registrationClosesAt" TIMESTAMP(3),
ADD COLUMN "registrationCapacity" INTEGER,
ADD COLUMN "hasOptionalMerchandise" BOOLEAN NOT NULL DEFAULT false;

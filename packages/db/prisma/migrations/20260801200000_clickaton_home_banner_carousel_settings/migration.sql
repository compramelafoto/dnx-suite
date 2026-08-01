-- CreateTable
CREATE TABLE "ClickatonHomeBannerSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoplayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoplayMs" INTEGER NOT NULL DEFAULT 2000,
    "transitionMs" INTEGER NOT NULL DEFAULT 700,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonHomeBannerSettings_pkey" PRIMARY KEY ("id")
);

-- Seed fila única con defaults (2s + slide suave)
INSERT INTO "ClickatonHomeBannerSettings" ("id", "autoplayEnabled", "autoplayMs", "transitionMs", "updatedAt")
VALUES ('default', true, 2000, 700, CURRENT_TIMESTAMP);

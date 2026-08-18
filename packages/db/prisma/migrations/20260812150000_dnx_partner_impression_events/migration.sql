-- ETAPA 09 Imp 01 — Partner Analytics impressions (aditivo, sin DROP).
CREATE TABLE IF NOT EXISTS "DnxPartnerImpressionEvent" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "creativeId" TEXT,
    "outboundLinkId" TEXT,
    "application" "DnxPartnerApplication" NOT NULL,
    "contextType" "DnxPartnerContextType" NOT NULL DEFAULT 'GLOBAL',
    "contextId" TEXT,
    "placement" "DnxPartnerPlacement" NOT NULL DEFAULT 'LOGO_MARQUEE',
    "adPlacementKey" VARCHAR(80),
    "deviceClass" "DnxPartnerDeviceClass" NOT NULL DEFAULT 'OTHER',
    "sourceType" VARCHAR(24) NOT NULL DEFAULT 'CAMPAIGN',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "DnxPartnerImpressionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_partnerId_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("partnerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_campaignId_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("campaignId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_application_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("application", "occurredAt");
CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_creativeId_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("creativeId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_placement_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("placement", "occurredAt");
CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "DnxPartnerImpressionEvent_adPlacementKey_occurredAt_idx"
  ON "DnxPartnerImpressionEvent"("adPlacementKey", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "DnxPartnerImpressionEvent"
    ADD CONSTRAINT "DnxPartnerImpressionEvent_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DNX Partners — click tracking / outbound attribution (aditiva).
-- No DROP TABLE / TRUNCATE / delete de datos.

CREATE TYPE "DnxPartnerOutboundLinkStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "DnxPartnerPlacement" AS ENUM (
  'LOGO',
  'PARTNER_NAME',
  'SPONSOR_SECTION',
  'ORGANIZER_SECTION',
  'PRIZE',
  'BENEFIT',
  'CTA',
  'ASSET',
  'BANNER',
  'ARTICLE',
  'OTHER'
);

CREATE TYPE "DnxPartnerDeviceClass" AS ENUM (
  'MOBILE',
  'TABLET',
  'DESKTOP',
  'OTHER'
);

ALTER TABLE "DnxPartnerParticipation"
  ADD COLUMN "destinationUrl" TEXT,
  ADD COLUMN "clickTrackingEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "DnxPartnerOutboundLink" (
  "id" TEXT NOT NULL,
  "trackingKey" VARCHAR(80) NOT NULL,
  "partnerId" TEXT NOT NULL,
  "participationId" TEXT,
  "application" "DnxPartnerApplication" NOT NULL,
  "contextType" "DnxPartnerContextType" NOT NULL DEFAULT 'GLOBAL',
  "contextId" TEXT,
  "assetId" TEXT,
  "placement" "DnxPartnerPlacement" NOT NULL DEFAULT 'LOGO',
  "destinationUrl" TEXT NOT NULL,
  "utmSource" VARCHAR(80),
  "utmMedium" VARCHAR(80),
  "utmCampaign" VARCHAR(160),
  "utmContent" VARCHAR(160),
  "status" "DnxPartnerOutboundLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "DnxPartnerOutboundLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPartnerOutboundLink_trackingKey_key"
  ON "DnxPartnerOutboundLink"("trackingKey");

CREATE INDEX "DnxPartnerOutboundLink_partnerId_idx"
  ON "DnxPartnerOutboundLink"("partnerId");

CREATE INDEX "DnxPartnerOutboundLink_participationId_idx"
  ON "DnxPartnerOutboundLink"("participationId");

CREATE INDEX "DnxPartnerOutboundLink_application_contextId_idx"
  ON "DnxPartnerOutboundLink"("application", "contextId");

CREATE INDEX "DnxPartnerOutboundLink_status_idx"
  ON "DnxPartnerOutboundLink"("status");

ALTER TABLE "DnxPartnerOutboundLink"
  ADD CONSTRAINT "DnxPartnerOutboundLink_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerOutboundLink"
  ADD CONSTRAINT "DnxPartnerOutboundLink_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DnxPartnerClickEvent" (
  "id" TEXT NOT NULL,
  "outboundLinkId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "participationId" TEXT,
  "application" "DnxPartnerApplication" NOT NULL,
  "contextType" "DnxPartnerContextType" NOT NULL DEFAULT 'GLOBAL',
  "contextId" TEXT,
  "assetId" TEXT,
  "placement" "DnxPartnerPlacement" NOT NULL DEFAULT 'LOGO',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "referrerHost" VARCHAR(255),
  "deviceClass" "DnxPartnerDeviceClass" NOT NULL DEFAULT 'OTHER',
  "browserFamily" VARCHAR(40),
  "countryCode" VARCHAR(2),
  "metadata" JSONB,

  CONSTRAINT "DnxPartnerClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerClickEvent_outboundLinkId_idx"
  ON "DnxPartnerClickEvent"("outboundLinkId");

CREATE INDEX "DnxPartnerClickEvent_partnerId_idx"
  ON "DnxPartnerClickEvent"("partnerId");

CREATE INDEX "DnxPartnerClickEvent_participationId_idx"
  ON "DnxPartnerClickEvent"("participationId");

CREATE INDEX "DnxPartnerClickEvent_application_idx"
  ON "DnxPartnerClickEvent"("application");

CREATE INDEX "DnxPartnerClickEvent_contextId_idx"
  ON "DnxPartnerClickEvent"("contextId");

CREATE INDEX "DnxPartnerClickEvent_occurredAt_idx"
  ON "DnxPartnerClickEvent"("occurredAt");

CREATE INDEX "DnxPartnerClickEvent_partner_occurred_idx"
  ON "DnxPartnerClickEvent"("partnerId", "occurredAt");

ALTER TABLE "DnxPartnerClickEvent"
  ADD CONSTRAINT "DnxPartnerClickEvent_outboundLinkId_fkey"
  FOREIGN KEY ("outboundLinkId") REFERENCES "DnxPartnerOutboundLink"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerClickEvent"
  ADD CONSTRAINT "DnxPartnerClickEvent_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

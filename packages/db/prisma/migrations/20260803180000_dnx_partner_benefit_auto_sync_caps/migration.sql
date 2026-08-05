-- Additive: capabilities for automatic benefit access sync (Stage 03 Imp 02).
-- Outbox reuses ClickatonIntegrationOutboxEvent (no new table).
-- Rollback: remove grant rows with these capabilities; ALTER TYPE drop value is not supported on PG.

ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_VIEW_SYNC_EVENTS';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_PROCESS_SYNC_EVENTS';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_RETRY_SYNC_EVENTS';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_DISCARD_SYNC_EVENTS';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_ENABLE_AUTO_SYNC';

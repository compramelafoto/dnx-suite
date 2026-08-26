import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("partner impression ingest privacy + soft-fail", () => {
  it("does not persist IP, UA raw, userId, email or fingerprint", () => {
    const src = readFileSync(join(here, "partners-impression-ingest.ts"), "utf8");
    assert.match(src, /ingestPartnerImpression/);
    assert.match(src, /isLikelyBotUserAgent/);
    assert.match(src, /classifyDeviceClass/);
    assert.doesNotMatch(src, /ipAddress|userId|email|fingerprint|userAgent:\s*ua/);
    assert.match(src, /soft_fail/);
  });

  it("resolves metadata from trackingKey + creativeId + placementKey", () => {
    const src = readFileSync(join(here, "partners-impression-ingest.ts"), "utf8");
    assert.match(src, /dnxPartnerOutboundLink\.findUnique/);
    assert.match(src, /dnxPartnerCampaignCreative\.findFirst/);
    assert.match(src, /wrong_application|creative_invalid|target_paused/);
  });
});

describe("partner analytics multi-db", () => {
  it("aggregates remote targets with partial failure support", () => {
    const src = readFileSync(join(here, "partners-analytics-multi-db.ts"), "utf8");
    assert.match(src, /loadPartnerAnalyticsMultiDb/);
    assert.match(src, /getPartnersPublicationClient/);
    assert.match(src, /Datos temporalmente no disponibles|query_failed|ok: false/);
    assert.match(src, /DnxPartnerImpressionEvent/);
    assert.match(src, /DnxPartnerClickEvent/);
  });
});

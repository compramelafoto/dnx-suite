/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/talk-lead-source.test.ts
 */

import assert from "node:assert/strict";
import { buildTalkLeadSource, campaignFromSearch, sanitizeCampaign } from "./talk-lead-source";

{
  assert.equal(buildTalkLeadSource("charlafotoescolar", null), "charlafotoescolar");
  assert.equal(buildTalkLeadSource("charlafotoescolar", ""), "charlafotoescolar");
  assert.equal(buildTalkLeadSource("charlafotoescolar", "meta-escolar-oct"), "charlafotoescolar:meta-escolar-oct");
}

{
  assert.equal(sanitizeCampaign("Meta Escolar <script>"), "meta-escolar-script");
  assert.equal(sanitizeCampaign("   "), null);
  assert.equal(sanitizeCampaign(42), null);
  assert.equal(sanitizeCampaign("x".repeat(100))?.length, 60);
}

{
  assert.equal(campaignFromSearch("?utm_source=meta&utm_campaign=charla-29-10"), "charla-29-10");
  assert.equal(campaignFromSearch("?ref=correo-inactivos"), "correo-inactivos");
  assert.equal(campaignFromSearch("?utm_campaign=a&ref=b"), "a");
  assert.equal(campaignFromSearch(""), null);
}

console.log("talk-lead-source: OK");

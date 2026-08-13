import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("InfoSpot PartnerAdsWelcome regression", () => {
  it("sigue usando PartnerWelcomeInterstitial + INFOSPOT_HOME_WELCOME + 24h", () => {
    const src = readFileSync(join(here, "PartnerAdsWelcome.tsx"), "utf8");
    assert.match(src, /PartnerWelcomeInterstitial/);
    assert.match(src, /INFOSPOT_HOME_WELCOME/);
    assert.match(src, /frequencyHours=\{24\}/);
    assert.match(src, /Contenido patrocinado/);
    assert.match(src, /welcomeMedia/);
    assert.doesNotMatch(src, /FOTO_OFFICE/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("PartnerViewableImpression", () => {
  it("requires viewability threshold and duration", () => {
    const src = readFileSync(join(here, "PartnerViewableImpression.tsx"), "utf8");
    assert.match(src, /VIEWABILITY_RATIO = 0\.5/);
    assert.match(src, /VIEWABILITY_MS = 1000/);
    assert.match(src, /IntersectionObserver/);
    assert.match(src, /logicalViewKey|campaignId.*creativeId.*placementKey/);
    assert.match(src, /sendBeacon|fetch/);
  });
});

describe("PartnerLogoMarquee impression dedupe", () => {
  it("only tracks canonical loop copy 0", () => {
    const src = readFileSync(join(here, "PartnerLogoMarquee.tsx"), "utf8");
    assert.match(src, /data-loop-copy/);
    assert.match(src, /enabled=\{!isCopy\}/);
    assert.match(src, /PartnerViewableImpression/);
  });
});

describe("PartnerWelcomeInterstitial", () => {
  it("does not render impression when closed / frequency capped", () => {
    const src = readFileSync(join(here, "PartnerWelcomeInterstitial.tsx"), "utf8");
    assert.match(src, /if \(!open\) return null/);
    assert.match(src, /PartnerViewableImpression/);
    assert.match(src, /frequencyHours/);
  });
});

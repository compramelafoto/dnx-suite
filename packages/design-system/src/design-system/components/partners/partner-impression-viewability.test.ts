import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("PartnerViewableImpression", () => {
  const src = readFileSync(join(here, "PartnerViewableImpression.tsx"), "utf8");

  it("requires viewability threshold and duration", () => {
    assert.match(src, /VIEWABILITY_RATIO = 0\.5/);
    assert.match(src, /VIEWABILITY_MS = 1000/);
    assert.match(src, /IntersectionObserver/);
    assert.match(src, /logicalViewKey|campaignId.*creativeId.*placementKey/);
    assert.match(src, /sendBeacon|fetch/);
  });

  it("fires without requiring outbound href/trackingKey", () => {
    assert.doesNotMatch(src, /if \(!trackingKey\) return/);
    assert.match(src, /campaignId/);
    assert.match(src, /if \(trackingKey\) payload\.trackingKey/);
    assert.match(src, /enabled/);
  });
});

describe("PartnerLogoMarquee impression dedupe + a11y", () => {
  const src = readFileSync(join(here, "PartnerLogoMarquee.tsx"), "utf8");

  it("only tracks canonical loop copy; pause hover + focus-within; reduced motion", () => {
    assert.match(src, /data-loop-copy/);
    assert.match(src, /!isCopy/);
    assert.match(src, /PartnerViewableImpression/);
    assert.match(src, /:focus-within/);
    assert.match(src, /:hover/);
    assert.match(src, /prefers-reduced-motion: reduce/);
    assert.match(src, /resolvePartnerLogoMarqueeMotion/);
    assert.match(src, /itemCount >= 3/);
    assert.match(src, /focus-visible/);
    assert.match(src, /role="region"/);
    assert.match(src, /<ul/);
    assert.match(src, /--static/);
    assert.match(src, /--animate/);
  });

  it("tracks logos without href; never invents fake links; supports trackingEnabled=false", () => {
    assert.match(src, /trackingEnabled/);
    assert.match(src, /Boolean\(item\.campaignId && item\.creativeId && item\.placementKey\)/);
    assert.doesNotMatch(src, /placementKey && item\.href/);
    assert.match(src, /cursor: "default"/);
    assert.doesNotMatch(src, /href="#"/);
    assert.match(src, /Sin destino: no enlace falso/);
  });
});

describe("PartnerWelcomeInterstitial contracts", () => {
  const src = readFileSync(join(here, "PartnerWelcomeInterstitial.tsx"), "utf8");

  it("dialog a11y + escape + scroll lock + focus restore", () => {
    assert.match(src, /role="dialog"/);
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-labelledby/);
    assert.match(src, /Escape/);
    assert.match(src, /document\.body\.style\.overflow/);
    assert.match(src, /previousFocusRef/);
    assert.match(src, /closeRef/);
    assert.match(src, /aria-label="Cerrar"/);
  });

  it("sponsored label, reduced motion, stable random animation", () => {
    assert.match(src, /Contenido patrocinado/);
    assert.match(src, /prefers-reduced-motion/);
    assert.match(src, /useState\(\(\) => pickAnimation/);
    assert.match(src, /slide-left|slide-right|slide-up|fade/);
  });

  it("close does not navigate; marks shown on open; dismiss callback typed", () => {
    assert.match(src, /e\.stopPropagation\(\)/);
    assert.match(src, /markPartnerWelcomeShown/);
    assert.match(src, /PARTNER_WELCOME_DISMISS/);
    assert.match(src, /if \(!open\) return null/);
    assert.match(src, /PartnerViewableImpression/);
    assert.match(src, /openInNewTab/);
    assert.match(src, /safe-area-inset/);
    assert.match(src, /maxHeight: "min\(85dvh/);
  });

  it("impression tracking can be disabled without relying on missing href", () => {
    assert.match(src, /trackingEnabled/);
    assert.match(src, /trackingEnabled && creativeId && placementKey/);
  });
});

describe("PartnerAdCreative welcome tracking", () => {
  it("opens tracking links in new tab with noopener when requested", () => {
    const src = readFileSync(join(here, "PartnerAdCreative.tsx"), "utf8");
    assert.match(src, /openInNewTab/);
    assert.match(src, /noopener noreferrer/);
    assert.match(src, /\/r\//);
  });
});

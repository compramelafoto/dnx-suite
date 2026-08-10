/**
 * Contratos de superficies ads InfoSpot.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/partners-ads-surfaces.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

{
  const src = readFileSync(join(here, "../app/page.tsx"), "utf8");
  assert.match(src, /INFOSPOT_HOME_WELCOME/);
  assert.match(src, /INFOSPOT_HOME_TOP/);
  assert.match(src, /INFOSPOT_HOME_INLINE/);
  assert.match(src, /INFOSPOT_HOME_MARQUEE/);
  assert.match(src, /PartnerAdsWelcome/);
  assert.match(src, /PartnerLogoMarquee/);
}

{
  const articlePage = readFileSync(join(here, "../app/noticias/[slug]/page.tsx"), "utf8");
  const view = readFileSync(join(here, "../components/editorial/article-view.tsx"), "utf8");
  assert.match(articlePage, /INFOSPOT_ARTICLE_INLINE/);
  assert.match(view, /partnerInlineSlot/);
}

{
  const src = readFileSync(join(here, "../app/eventos/[slug]/page.tsx"), "utf8");
  assert.match(src, /INFOSPOT_EVENT_PAGE/);
  assert.match(src, /PartnerAdsSlot/);
}

{
  const src = readFileSync(join(here, "../app/r/[trackingKey]/route.ts"), "utf8");
  assert.match(src, /resolveOutboundRedirect/);
  assert.match(src, /createPartnersService/);
}

console.log("partners-ads-surfaces (infospot): ok");

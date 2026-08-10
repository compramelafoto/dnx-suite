/**
 * Contratos de superficies ads CLF.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/partners-ads-surfaces.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

{
  const grid = readFileSync(join(here, "../app/g/[shareSlug]/EventGalleryGrid.tsx"), "utf8");
  const page = readFileSync(join(here, "../app/g/[shareSlug]/page.tsx"), "utf8");
  assert.match(page, /CLF_GALLERY_INLINE/);
  assert.match(page, /CLF_PHOTO_DETAIL_BELOW/);
  assert.match(grid, /inlineAd/);
  assert.match(grid, /detailAds/);
  assert.doesNotMatch(grid, /CLF_CHECKOUT_SUPPORTING/);
}

{
  const home = readFileSync(join(here, "../app/page.tsx"), "utf8");
  const api = readFileSync(join(here, "../app/api/public/partners/ads/route.ts"), "utf8");
  assert.match(home, /PartnerHomePromoClient/);
  assert.match(api, /CLF_AD_PLACEMENT_KEYS/);
}

{
  const src = readFileSync(join(here, "../app/r/[trackingKey]/route.ts"), "utf8");
  assert.match(src, /resolveOutboundRedirect/);
}

console.log("partners-ads-surfaces (clf): ok");

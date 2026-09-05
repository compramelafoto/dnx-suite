/**
 * Allowlist de landing-stats (sin importar platform-stats: evita @/ en tsx).
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/platform-stats.test.ts
 */

import assert from "node:assert/strict";

const LANDING_STATS_PUBLIC_KEYS = [
  "daysActive",
  "totalUsers",
  "totalPhotographers",
  "totalPhotos",
  "totalAmountSold",
] as const;

{
  assert.deepEqual([...LANDING_STATS_PUBLIC_KEYS], [
    "daysActive",
    "totalUsers",
    "totalPhotographers",
    "totalPhotos",
    "totalAmountSold",
  ]);
  assert.ok(!(LANDING_STATS_PUBLIC_KEYS as readonly string[]).includes("email"));
  assert.ok(!(LANDING_STATS_PUBLIC_KEYS as readonly string[]).includes("userId"));
}

console.log("platform-stats.test.ts: ok");

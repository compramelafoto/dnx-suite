/**
 * Tests de invalidación del feed (tags + wiring).
 * Ejecutar: pnpm --filter infospot test:feed:invalidate
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_FEED_CACHE_TAGS,
  collectPublicFeedRevalidateTags,
} from "./invalidate";

// 1. Tags canónicos presentes
{
  assert.ok(PUBLIC_FEED_CACHE_TAGS.includes("infospot-home-feed"));
  assert.ok(PUBLIC_FEED_CACHE_TAGS.includes("infospot-public-content"));
  assert.ok(PUBLIC_FEED_CACHE_TAGS.includes("infospot-home"));
}

// 2. collectPublicFeedRevalidateTags incluye item
{
  const tags = collectPublicFeedRevalidateTags({ itemId: "article:xyz" });
  assert.deepEqual(
    tags.slice(0, 3).sort(),
    [...PUBLIC_FEED_CACHE_TAGS].sort(),
  );
  assert.ok(tags.includes("infospot-feed-item:article:xyz"));
}

// 3. Wiring real: las funciones de producción invocan revalidateTag con esos tags
{
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = [
    "lib/feed/invalidate.ts",
    "lib/event-revalidate.ts",
    "app/actions/editorial-workflow.ts",
    "app/actions/homepage-distribution.ts",
  ];
  for (const rel of files) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.ok(
      src.includes('revalidateTag("infospot-home-feed"') ||
        src.includes("PUBLIC_FEED_CACHE_TAGS") ||
        src.includes("collectPublicFeedRevalidateTags"),
      `${rel} debe invalidar infospot-home-feed`,
    );
    assert.ok(
      src.includes('revalidateTag("infospot-public-content"') ||
        src.includes("PUBLIC_FEED_CACHE_TAGS") ||
        src.includes("collectPublicFeedRevalidateTags"),
      `${rel} debe invalidar infospot-public-content`,
    );
  }

  const eventRev = readFileSync(join(root, "lib/event-revalidate.ts"), "utf8");
  assert.ok(eventRev.includes('revalidateTag("infospot-home-feed"'));
  assert.ok(eventRev.includes('revalidateTag("infospot-public-content"'));
  assert.ok(eventRev.includes("infospot-feed-item:event:"));

  const editorial = readFileSync(
    join(root, "app/actions/editorial-workflow.ts"),
    "utf8",
  );
  assert.ok(editorial.includes('revalidateTag("infospot-home-feed"'));
  assert.ok(editorial.includes("infospot-feed-item:article:"));
}

console.log("feed invalidate tests: ok");

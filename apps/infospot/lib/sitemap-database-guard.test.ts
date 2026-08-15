/**
 * Test del guard de DATABASE_URL para el sitemap.
 * pnpm --filter infospot test:sitemap
 */

import assert from "node:assert/strict";
import { shouldLoadPublishedSitemapEntries } from "./sitemap-database-guard";

assert.equal(shouldLoadPublishedSitemapEntries(undefined), false);
assert.equal(shouldLoadPublishedSitemapEntries(""), false);
assert.equal(shouldLoadPublishedSitemapEntries("   "), false);
assert.equal(
  shouldLoadPublishedSitemapEntries("postgres://user:pass@host:5432/db"),
  true,
);

console.log("sitemap-database-guard.test.ts OK");

/**
 * Selfcheck: key builder + guards (sin I/O R2).
 *   pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/entries/persist-canonical-asset.selfcheck.ts
 */
import {
  buildVersionedEntryStorageKey,
  storageKeyContainsPiiLeak,
} from "../storage/private-local-storage";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log("ok —", msg);
}

const key = buildVersionedEntryStorageKey({
  contestId: "c_contest",
  entryId: "c_entry",
  versionNumber: 1,
  kind: "original",
  assetId: "c_asset",
});
assert(key.startsWith("fotorank/contests/"), "prefix fotorank/");
assert(!storageKeyContainsPiiLeak(key), "key sin PII");
assert(
  storageKeyContainsPiiLeak("fotorank/contests/x/user@mail.com"),
  "detecta email en key",
);

console.log("FINAL: PASS");

import test from "node:test";
import assert from "node:assert/strict";

import { contestHasStoreArtworks, type ContestStoreUsageDb } from "./contest-store-usage";

function base(conteos: Partial<Record<keyof ContestStoreUsageDb, number>>) {
  const pedidos: string[] = [];
  const contador = (k: keyof ContestStoreUsageDb) => ({
    count: async ({ where }: { where: { contestId: string } }) => {
      pedidos.push(`${k}:${where.contestId}`);
      return conteos[k] ?? 0;
    },
  });
  const db: ContestStoreUsageDb = {
    artworkListing: contador("artworkListing"),
    artworkConsent: contador("artworkConsent"),
    contestStoreSettings: contador("contestStoreSettings"),
    artworkRoyalty: contador("artworkRoyalty"),
  };
  return { db, pedidos };
}

test("sin nada de la tienda → se puede borrar", async () => {
  const { db, pedidos } = base({});
  assert.equal(await contestHasStoreArtworks("c1", db), false);
  assert.deepEqual(pedidos.sort(), [
    "artworkConsent:c1",
    "artworkListing:c1",
    "artworkRoyalty:c1",
    "contestStoreSettings:c1",
  ]);
});

for (const k of ["artworkListing", "artworkConsent", "contestStoreSettings", "artworkRoyalty"] as const) {
  test(`con filas en ${k} → no se puede borrar`, async () => {
    assert.equal(await contestHasStoreArtworks("c1", base({ [k]: 1 }).db), true);
  });
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDesiredPrize,
  mergePremiosRecompensas,
  resolveSfefCategories,
  stablePrizeId,
  upsertSfefPrizes,
} from "./sfef-configure-prizes.ts";

const cats = [
  { id: "c-pro", slug: "fotografo-profesional", name: "Fotógrafo Profesional", sortOrder: 1 },
  { id: "c-ama", slug: "fotografo-amateur", name: "Fotógrafo Amateur", sortOrder: 2 },
  { id: "c-rep", slug: "reportero-grafico", name: "Reportero Gráfico", sortOrder: 3 },
  { id: "c-aer", slug: "fotografia-aerea", name: "Fotografía Aérea", sortOrder: 4 },
];

describe("sfef-configure-prizes", () => {
  it("resolves the four official category slugs", () => {
    const resolved = resolveSfefCategories(cats);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.categories.length, 4);
  });

  it("creates 12 prizes from empty state", () => {
    const result = upsertSfefPrizes({ existingPrizes: [], categories: cats });
    assert.equal(result.validation.ok, true);
    assert.equal(result.prizes.length, 12);
    assert.equal(result.changes.filter((c) => c.action === "create").length, 12);
    assert.equal(result.validation.grandTotal, 4_800_000);
    for (const row of result.validation.perCategory) {
      assert.equal(row.count, 3);
      assert.equal(row.sum, 1_200_000);
    }
    assert.deepEqual(
      result.prizes.map((p) => p.amount),
      [500_000, 400_000, 300_000, 500_000, 400_000, 300_000, 500_000, 400_000, 300_000, 500_000, 400_000, 300_000],
    );
    assert.ok(result.prizes.every((p) => p.currency === "ARS"));
    assert.ok(result.prizes.every((p) => p.deliveryStatus === "PENDING"));
    assert.ok(result.prizes.every((p) => !p.winnerLabel && !p.assignedAt));
  });

  it("keeps correct prizes on re-run (idempotent)", () => {
    const first = upsertSfefPrizes({ existingPrizes: [], categories: cats });
    const second = upsertSfefPrizes({ existingPrizes: first.prizes, categories: cats });
    assert.equal(second.validation.ok, true);
    assert.equal(second.changes.filter((c) => c.action === "keep").length, 12);
    assert.equal(second.changes.filter((c) => c.action === "create").length, 0);
    assert.equal(second.changes.filter((c) => c.action === "update").length, 0);
  });

  it("updates incorrect amounts and removes duplicates", () => {
    const wrong = buildDesiredPrize({
      categoryId: "c-pro",
      categorySlug: "fotografo-profesional",
      place: 1,
      amount: 500_000,
      positionLabel: "1.º",
      name: "1.º Premio",
    });
    const { place: _place, ...canonical } = wrong;
    const existing = [
      { ...canonical, amount: 100, shortDescription: "malo" },
      {
        id: "dup-pro-1",
        name: "1er premio",
        type: "CASH",
        scope: "CATEGORY",
        categoryId: "c-pro",
        positionLabel: "1.º",
        isMonetary: true,
        amount: 500_000,
        currency: "ARS",
      },
    ];
    const result = upsertSfefPrizes({ existingPrizes: existing, categories: cats });
    assert.equal(result.validation.ok, true);
    assert.equal(result.prizes.length, 12);
    assert.ok(result.changes.some((c) => c.action === "update" && c.prizeId === stablePrizeId("fotografo-profesional", 1)));
    assert.ok(result.changes.some((c) => c.action === "remove_duplicate" && c.prizeId === "dup-pro-1"));
    const pro1 = result.prizes.find((p) => p.id === stablePrizeId("fotografo-profesional", 1));
    assert.equal(pro1?.amount, 500_000);
  });

  it("merges without wiping rewards/economy and without assigning winners", () => {
    const result = upsertSfefPrizes({ existingPrizes: [], categories: cats });
    const merged = mergePremiosRecompensas(
      {
        otherKey: true,
        premiosRecompensas: {
          rewards: [{ id: "rw-1", name: "Keep" }],
          economy: { entryMode: "FREE", reviewedByOrganizer: true },
        },
      },
      result.prizes,
    );
    const module = merged.premiosRecompensas as {
      prizes: Array<{ deliveryStatus: string; winnerLabel?: string }>;
      rewards: unknown[];
      economy: { entryMode: string; reviewedByOrganizer: boolean; platformIntervenesMonetaryPrizes: boolean };
    };
    assert.equal(merged.otherKey, true);
    assert.equal(module.prizes.length, 12);
    assert.equal(module.rewards.length, 1);
    assert.equal(module.economy.entryMode, "FREE");
    assert.equal(module.economy.reviewedByOrganizer, true);
    assert.equal(module.economy.platformIntervenesMonetaryPrizes, false);
    assert.ok(module.prizes.every((p) => p.deliveryStatus === "PENDING" && !p.winnerLabel));
  });
});

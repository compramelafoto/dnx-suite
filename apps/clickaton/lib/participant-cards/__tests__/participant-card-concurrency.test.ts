import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FixedPngRenderProvider,
  InMemoryParticipantCardRepository,
  MemoryParticipantCardAssetStore,
  getOrGenerateClickatonParticipantCard,
  type ParticipantCardPersistenceDeps,
} from "@/lib/participant-cards";
import {
  mockFixedPng,
  mockParticipantCardRegistration,
} from "./participant-card-test-fixtures";

const adminActor = {
  kind: "admin" as const,
  userId: 1,
  email: "admin@test.local",
  globalRole: "SUPER_ADMIN",
};

describe("participant card concurrency", () => {
  it("parallel getOrGenerate performs only one render", async () => {
    const repo = new InMemoryParticipantCardRepository();
    let renderCount = 0;
    const png = mockFixedPng();
    const provider = new FixedPngRenderProvider(png, 1080, 1920, 150);
    const originalRender = provider.render.bind(provider);
    provider.render = async (input) => {
      renderCount++;
      return originalRender(input);
    };

    const deps: ParticipantCardPersistenceDeps = {
      repository: repo,
      store: new MemoryParticipantCardAssetStore(),
      renderProvider: provider,
      now: () => new Date("2026-08-01T12:00:00.000Z"),
      loadRegistration: async (id) =>
        id === "reg_test_001" ? mockParticipantCardRegistration() : null,
      loadPhotoContentHash: async () => "photo-hash-v1",
      persistAsset: async () => "asset_test_001",
    };

    const input = {
      registrationId: "reg_test_001",
      cardType: "welcome" as const,
      actor: adminActor,
      mode: "preview" as const,
    };

    const [a, b] = await Promise.all([
      getOrGenerateClickatonParticipantCard(input, deps),
      getOrGenerateClickatonParticipantCard(input, deps),
    ]);

    assert.equal(renderCount, 1, `expected exactly 1 render, got ${renderCount}`);
    assert.equal(a.renderHash, b.renderHash);
    const statuses = new Set([a.cacheStatus, b.cacheStatus]);
    assert.ok(statuses.has("HIT"));
    assert.ok(statuses.has("HIT") || statuses.has("MISS"));
  });
});

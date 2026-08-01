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

describe("participant card render cache HIT/MISS", () => {
  it("MISS then HIT reuses stored PNG without second render", async () => {
    const repo = new InMemoryParticipantCardRepository();
    let renderCount = 0;
    const png = mockFixedPng();
    const provider = new FixedPngRenderProvider(png);
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

    const first = await getOrGenerateClickatonParticipantCard(
      {
        registrationId: "reg_test_001",
        cardType: "welcome",
        actor: adminActor,
        mode: "preview",
      },
      deps
    );
    assert.equal(first.cacheStatus, "MISS");
    assert.equal(renderCount, 1);

    const second = await getOrGenerateClickatonParticipantCard(
      {
        registrationId: "reg_test_001",
        cardType: "welcome",
        actor: adminActor,
        mode: "preview",
      },
      deps
    );
    assert.equal(second.cacheStatus, "HIT");
    assert.equal(renderCount, 1);
    assert.equal(
      second.png.toString("base64"),
      first.png.toString("base64")
    );
    assert.equal(second.renderHash, first.renderHash);
  });
});

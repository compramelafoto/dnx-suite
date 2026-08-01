import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FixedPngRenderProvider,
  InMemoryParticipantCardRepository,
  MemoryParticipantCardAssetStore,
  getOrGenerateClickatonParticipantCard,
  getClickatonParticipantCardStatus,
  type ParticipantCardPersistenceDeps,
} from "@/lib/participant-cards";
import {
  mockFixedPng,
  mockParticipantCardRegistration,
} from "./participant-card-test-fixtures";

function testDeps(
  repo: InMemoryParticipantCardRepository,
  png = mockFixedPng()
): ParticipantCardPersistenceDeps {
  return {
    repository: repo,
    store: new MemoryParticipantCardAssetStore(),
    renderProvider: new FixedPngRenderProvider(png),
    now: () => new Date("2026-08-01T12:00:00.000Z"),
    loadRegistration: async (id) =>
      id === "reg_test_001" ? mockParticipantCardRegistration() : null,
    loadPhotoContentHash: async () => "photo-hash-v1",
    persistAsset: async () => "asset_test_001",
  };
}

const adminActor = {
  kind: "admin" as const,
  userId: 1,
  email: "admin@test.local",
  globalRole: "SUPER_ADMIN",
};

describe("getOrGenerateClickatonParticipantCard persistence", () => {
  it("generates MISS on first call and persists READY record", async () => {
    const repo = new InMemoryParticipantCardRepository();
    const deps = testDeps(repo);
    const result = await getOrGenerateClickatonParticipantCard(
      {
        registrationId: "reg_test_001",
        cardType: "welcome",
        actor: adminActor,
        mode: "preview",
      },
      deps
    );
    assert.equal(result.cacheStatus, "MISS");
    assert.ok(result.renderHash);
    assert.equal(result.png.toString("base64"), mockFixedPng().toString("base64"));
    const status = await getClickatonParticipantCardStatus(
      { registrationId: "reg_test_001", cardType: "welcome", actor: adminActor },
      deps
    );
    assert.equal(status.status, "READY");
  });

  it("returns same renderHash for stable inputs", async () => {
    const repo = new InMemoryParticipantCardRepository();
    const deps = testDeps(repo);
    const first = await getOrGenerateClickatonParticipantCard(
      {
        registrationId: "reg_test_001",
        cardType: "member",
        actor: adminActor,
        mode: "preview",
      },
      deps
    );
    const second = await getOrGenerateClickatonParticipantCard(
      {
        registrationId: "reg_test_001",
        cardType: "member",
        actor: adminActor,
        mode: "preview",
      },
      deps
    );
    assert.equal(first.renderHash, second.renderHash);
  });
});

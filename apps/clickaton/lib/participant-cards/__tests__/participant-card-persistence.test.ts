import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FixedPngRenderProvider,
  InMemoryParticipantCardRepository,
  MemoryParticipantCardAssetStore,
  getOrGenerateClickatonParticipantCard,
  getClickatonParticipantCardStatus,
  getReadyClickatonDiplomaCard,
  loadClickatonParticipantCardAssetBytes,
  type ParticipantCardPersistenceDeps,
  type ReadyClickatonDiplomaCardRow,
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

function diplomaRow(
  overrides: Partial<ReadyClickatonDiplomaCardRow> = {}
): ReadyClickatonDiplomaCardRow {
  return {
    id: "card_diploma_001",
    registrationId: "reg_test_001",
    editionId: "edition_test_001",
    assetId: "asset_png_001",
    storageKey: "clickaton/participant-cards/diploma.png",
    pdfAssetId: "asset_pdf_001",
    pdfStorageKey: "clickaton/participant-cards/diploma.pdf",
    generatedAt: new Date("2026-09-20T12:00:00.000Z"),
    ...overrides,
  };
}

const participantActor = {
  kind: "participant" as const,
  userId: 42,
  email: "participante@test.local",
};

const otherParticipantActor = {
  kind: "participant" as const,
  userId: 999,
  email: "otro@test.local",
};

describe("getReadyClickatonDiplomaCard", () => {
  it("el dueño ve su diploma emitido", async () => {
    const card = await getReadyClickatonDiplomaCard(
      { registrationId: "reg_test_001", actor: participantActor },
      {
        loadRegistration: async (id) =>
          id === "reg_test_001" ? mockParticipantCardRegistration() : null,
        findCurrentDiplomaCardId: async () => "card_diploma_001",
        findReadyDiplomaCardById: async () => diplomaRow(),
      }
    );
    assert.ok(card);
    assert.equal(card?.registrationId, "reg_test_001");
    assert.equal(card?.pdfStorageKey, "clickaton/participant-cards/diploma.pdf");
  });

  it("un participante ajeno no ve el diploma de otro (404, no se revela existencia)", async () => {
    await assert.rejects(
      getReadyClickatonDiplomaCard(
        { registrationId: "reg_test_001", actor: otherParticipantActor },
        {
          loadRegistration: async (id) =>
            id === "reg_test_001" ? mockParticipantCardRegistration() : null,
          findCurrentDiplomaCardId: async () => "card_diploma_001",
          findReadyDiplomaCardById: async () => diplomaRow(),
        }
      ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as { code?: string }).code, "CLICKATON_CARD_NOT_FOUND");
        return true;
      }
    );
  });

  it("devuelve null cuando todavía no se emitió el diploma", async () => {
    const card = await getReadyClickatonDiplomaCard(
      { registrationId: "reg_test_001", actor: participantActor },
      {
        loadRegistration: async (id) =>
          id === "reg_test_001" ? mockParticipantCardRegistration() : null,
        findCurrentDiplomaCardId: async () => null,
        findReadyDiplomaCardById: async () => {
          throw new Error("no debería buscar la pieza sin un emisor vigente");
        },
      }
    );
    assert.equal(card, null);
  });

  it("un diploma revocado no se puede descargar aunque su pieza siga READY", async () => {
    // `findCurrentDiplomaCardId` modela el `WHERE revokedAt IS NULL` de
    // `defaultFindCurrentDiplomaCardId`: si el único emisor de la
    // inscripción está revocado, no hay ningún cardId vigente, así que acá
    // devuelve null — igual que la base real haría con ese where.
    const card = await getReadyClickatonDiplomaCard(
      { registrationId: "reg_test_001", actor: participantActor },
      {
        loadRegistration: async (id) =>
          id === "reg_test_001" ? mockParticipantCardRegistration() : null,
        findCurrentDiplomaCardId: async () => null,
        findReadyDiplomaCardById: async () => diplomaRow(),
      }
    );
    assert.equal(card, null);
  });

  it("re-emitido: sólo se sirve la pieza del emisor vigente, no cualquier pieza READY vieja", async () => {
    // Reemisión: la inscripción tiene dos piezas READY (la vieja, del
    // emisor revocado, y la nueva, del emisor vigente). El lookup tiene que
    // pedir puntualmente la pieza del cardId vigente, nunca "la más
    // reciente que esté READY" a secas.
    let requestedCardId: string | null = null;
    const card = await getReadyClickatonDiplomaCard(
      { registrationId: "reg_test_001", actor: participantActor },
      {
        loadRegistration: async (id) =>
          id === "reg_test_001" ? mockParticipantCardRegistration() : null,
        findCurrentDiplomaCardId: async () => "card_diploma_002_vigente",
        findReadyDiplomaCardById: async (input) => {
          requestedCardId = input.cardId;
          if (input.cardId !== "card_diploma_002_vigente") return null;
          return diplomaRow({ id: "card_diploma_002_vigente" });
        },
      }
    );
    assert.equal(requestedCardId, "card_diploma_002_vigente");
    assert.equal(card?.id, "card_diploma_002_vigente");
  });
});

describe("loadClickatonParticipantCardAssetBytes", () => {
  it("lee por storageKey cuando está disponible", async () => {
    const store = new MemoryParticipantCardAssetStore();
    await store.putAtKey("clickaton/participant-cards/diploma.pdf", Buffer.from("pdf-bytes"));
    const bytes = await loadClickatonParticipantCardAssetBytes(
      { assetId: null, storageKey: "clickaton/participant-cards/diploma.pdf" },
      store
    );
    assert.equal(bytes.toString("utf8"), "pdf-bytes");
  });

  it("revienta con un mensaje claro si no hay ni storageKey ni assetId", async () => {
    const store = new MemoryParticipantCardAssetStore();
    await assert.rejects(
      loadClickatonParticipantCardAssetBytes({ assetId: null, storageKey: null }, store),
      /PARTICIPANT_CARD_BYTES_MISSING/
    );
  });
});

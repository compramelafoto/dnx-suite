import { beforeEach, describe, expect, it, vi } from "vitest";

/* Caracterización del PATCH de un pack después de mover las reglas básicas a lib/album-packs/album-pack-basic-rules.ts. */

const m = vi.hoisted(() => ({ album: vi.fn(), pack: vi.fn(), update: vi.fn(), full: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    albumPack: {
      update: (...a: unknown[]) => m.update(...a),
      findUniqueOrThrow: (...a: unknown[]) => m.full(...a),
    },
  };
  return {
    prisma: {
      album: { findFirst: (...a: unknown[]) => m.album(...a) },
      albumPack: { findFirst: (...a: unknown[]) => m.pack(...a) },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
    Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER", ADMIN: "ADMIN" },
    AlbumPackType: { DIGITAL: "DIGITAL", PRINT: "PRINT", SCHOOL_FOLDER: "SCHOOL_FOLDER" },
    AlbumPackAvailabilityPhase: { PRE_UPLOAD: "PRE_UPLOAD", POST_UPLOAD: "POST_UPLOAD", ALWAYS: "ALWAYS" },
  };
});
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ error: null, user: { id: 10, role: "PHOTOGRAPHER" } })),
}));
vi.mock("@/lib/album-packs/album-pack-options", () => ({
  availabilityPhaseOptions: [{ value: "PRE_UPLOAD" }, { value: "POST_UPLOAD" }, { value: "ALWAYS" }],
  packTypeOptions: [{ value: "DIGITAL" }, { value: "PRINT" }, { value: "SCHOOL_FOLDER" }],
}));
vi.mock("@/lib/dashboard/template-v2-for-album-pack-picker", () => ({ isTemplateV2AssignableToUserPack: vi.fn() }));
vi.mock("@/lib/dashboard/legacy-template-list-where", () => ({ legacyTemplateListWhereForRole: vi.fn() }));
vi.mock("@/lib/template-v2/resolve-template-v2-for-album-pack", () => ({ resolveTemplateV2IdOwnedByAlbumPhotographer: vi.fn() }));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({
  loadCollaborativeEventPricingSnapshot: (...a: unknown[]) => m.lock(...a),
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING: "El organizador controla el precio",
}));
vi.mock("@/lib/album-packs/album-pack-components-persistence", () => ({
  AlbumPackComponentsValidationError: class extends Error {},
  assertAlbumPackPrintProductsActive: vi.fn(),
  parseAlbumPackComponentsInput: vi.fn(() => null),
  replaceAlbumPackComponents: vi.fn(),
  validateAlbumPackComponentsComposition: vi.fn(),
}));
vi.mock("@/lib/album-packs/album-pack-dashboard-api", () => ({
  albumPackDashboardInclude: {},
  deriveAlbumPackTypeFromComponents: vi.fn(),
  serializeAlbumPackForDashboardApi: (p: unknown) => p,
}));

import { PATCH } from "./route";

const call = (body: unknown) =>
  PATCH(new Request("http://x/api", { method: "PATCH", body: JSON.stringify(body) }) as never, {
    params: Promise.resolve({ id: "3", packId: "pk1" }),
  });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.album.mockResolvedValue({ id: 3, userId: 10, eventId: null });
  m.pack.mockResolvedValue({
    id: "pk1", includedPhotoCount: null, requiresSelection: false, requiresDesign: false, templateId: null, templateV2Id: null, packType: "PRINT",
  });
  m.lock.mockResolvedValue(null);
});

describe("PATCH /api/dashboard/albums/[id]/packs/[packId]", () => {
  it("nombre vacío → 400 con el texto de edición", async () => {
    const res = await call({ name: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name no puede estar vacío" });
  });
  it("precio negativo y cantidad 0 → 400 con los mismos textos", async () => {
    const r1 = await call({ price: -1 });
    expect(r1.status).toBe(400);
    expect(await r1.json()).toEqual({ error: "price debe ser un entero >= 0" });
    const r2 = await call({ includedPhotoCount: 0 });
    expect(await r2.json()).toEqual({ error: "includedPhotoCount debe ser un entero >= 1 o null" });
  });
  it("pedir selección sin cantidad (valor efectivo) → 400", async () => {
    const res = await call({ requiresSelection: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "includedPhotoCount es obligatorio cuando requiresSelection = true" });
  });
  it("sólo precio: actualiza sólo esa clave", async () => {
    m.full.mockResolvedValue({ id: "pk1" });
    const res = await call({ price: 200 });
    expect(res.status).toBe(200);
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: "pk1" }, data: { price: 200 } });
  });
});

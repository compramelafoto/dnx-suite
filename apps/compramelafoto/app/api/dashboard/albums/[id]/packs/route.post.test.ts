import { beforeEach, describe, expect, it, vi } from "vitest";

/* Caracterización del POST de packs después de mover las reglas básicas a lib/album-packs/album-pack-basic-rules.ts. */

const m = vi.hoisted(() => ({ album: vi.fn(), create: vi.fn(), full: vi.fn(), replace: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    albumPack: {
      create: (...a: unknown[]) => m.create(...a),
      findUniqueOrThrow: (...a: unknown[]) => m.full(...a),
    },
  };
  return {
    prisma: {
      album: { findFirst: (...a: unknown[]) => m.album(...a) },
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
  replaceAlbumPackComponents: (...a: unknown[]) => m.replace(...a),
  validateAlbumPackComponentsComposition: vi.fn(),
}));
vi.mock("@/lib/album-packs/album-pack-dashboard-api", () => ({
  albumPackDashboardInclude: {},
  deriveAlbumPackTypeFromComponents: vi.fn(),
  serializeAlbumPackForDashboardApi: (p: unknown) => p,
}));

import { POST } from "./route";

const call = (body: unknown) =>
  POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never, {
    params: Promise.resolve({ id: "3" }),
  });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.album.mockResolvedValue({ id: 3, userId: 10, eventId: null });
  m.lock.mockResolvedValue(null);
});

describe("POST /api/dashboard/albums/[id]/packs", () => {
  it("nombre vacío → 400 con el mismo texto", async () => {
    const res = await call({ name: "  ", price: 100, availabilityPhase: "ALWAYS", packType: "DIGITAL" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name es requerido" });
  });
  it("precio con decimales → 400 antes de mirar la fase", async () => {
    const res = await call({ name: "A", price: 1.5 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "price debe ser un entero >= 0" });
  });
  it("cantidad inválida se valida después del tipo de pack (mismo orden)", async () => {
    const r1 = await call({ name: "A", price: 1, availabilityPhase: "ALWAYS", packType: "X", includedPhotoCount: 0 });
    expect(await r1.json()).toEqual({ error: "packType inválido" });
    const r2 = await call({ name: "A", price: 1, availabilityPhase: "ALWAYS", packType: "DIGITAL", requiresSelection: true });
    expect(r2.status).toBe(400);
    expect(await r2.json()).toEqual({ error: "includedPhotoCount es obligatorio cuando requiresSelection = true" });
  });
  it("pack DIGITAL sin componentes: crea y no reemplaza componentes", async () => {
    m.create.mockResolvedValue({ id: "p1" });
    m.full.mockResolvedValue({ id: "p1" });
    const res = await call({ name: " 5 fotos ", price: 15000, availabilityPhase: "ALWAYS", packType: "DIGITAL", requiresSelection: true, includedPhotoCount: 5 });
    expect(res.status).toBe(201);
    expect(m.create.mock.calls[0]![0].data).toMatchObject({ albumId: 3, name: "5 fotos", price: 15000, includedPhotoCount: 5, requiresSelection: true, packType: "DIGITAL", isActive: true });
    expect(m.replace).not.toHaveBeenCalled();
  });
});

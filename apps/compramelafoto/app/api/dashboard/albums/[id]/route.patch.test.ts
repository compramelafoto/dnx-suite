import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Caracterización del PATCH de /api/dashboard/albums/[id] después de mover los
  campos de ajustes a lib/albums/album-settings-update.ts: mismas respuestas que antes.
*/

const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const appConfigFindUnique = vi.fn();
const loadSnapshot = vi.fn();
const ensureQueued = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: {
      findUnique: (...a: unknown[]) => albumFindUnique(...a),
      update: (...a: unknown[]) => albumUpdate(...a),
    },
    appConfig: { findUnique: (...a: unknown[]) => appConfigFindUnique(...a) },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
  EventFolderScope: { ORGANIZER: "ORGANIZER", PHOTOGRAPHER: "PHOTOGRAPHER" },
  Prisma: {},
  PrintPricingSource: {},
  AlbumMode: {},
  StudentIdentificationMode: {},
  OrganizerCommissionAppliesTo: {},
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ error: null, user: { id: 10 } })),
}));
vi.mock("@/lib/r2-client", () => ({ normalizePreviewUrl: vi.fn(), deleteFromR2: vi.fn() }));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({
  collaborativeEventPricingFromPricingRow: vi.fn(),
  loadCollaborativeEventPricingSnapshot: (...a: unknown[]) => loadSnapshot(...a),
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING: "El organizador controla el precio",
}));
vi.mock("@/lib/hidden-album/prepare-hidden-album-photos", () => ({
  ensureAlbumPhotosQueuedForHiddenMode: (...a: unknown[]) => ensureQueued(...a),
}));
vi.mock("@/lib/events/event-organizer-access", () => ({ isEventOrganizerUser: vi.fn() }));
vi.mock("@/lib/albums/album-photo-stats", () => ({
  loadAlbumPhotoStats: vi.fn(),
  loadEventFolderPhotoCounts: vi.fn(),
  countActiveAlbumPhotosForAlbum: vi.fn(async () => 3),
}));
vi.mock("@/lib/album/album-list-cover", () => ({ resolveAlbumStandaloneCoverUrl: vi.fn() }));

import { PATCH } from "./route";

const existingAlbum = {
  userId: 10,
  deletedAt: null,
  eventId: null as number | null,
  eventDate: null,
  startsAt: null,
  endsAt: null,
  termsAcceptedAt: new Date("2026-01-01T00:00:00Z"),
  termsVersion: "otra",
};

async function callPatch(body: unknown) {
  const req = { json: async () => body };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await PATCH(req as any, { params: Promise.resolve({ id: "7" }) });
  return { status: res.status, body: await res.json() };
}

describe("PATCH /api/dashboard/albums/[id] (ajustes movidos a la función compartida)", () => {
  beforeEach(() => {
    albumFindUnique.mockReset().mockResolvedValue(existingAlbum);
    albumUpdate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 7, ...data }));
    appConfigFindUnique.mockReset().mockResolvedValue({ minDigitalPhotoPrice: 5000 });
    loadSnapshot.mockReset().mockResolvedValue({ locksPhotographerDigitalPricing: false });
    ensureQueued.mockReset().mockResolvedValue(0);
  });

  it("precio debajo del mínimo → 400 con el mismo texto y sin guardar", async () => {
    const { status, body } = await callPatch({ digitalPhotoPriceCents: 4999 });
    expect(status).toBe(400);
    expect(body).toEqual({
      error: "El precio por foto digital no puede ser menor al mínimo del sistema (5000 pesos)",
    });
    expect(albumUpdate).not.toHaveBeenCalled();
  });

  it("álbum de evento: el título se ignora; sólo se guardan los demás campos", async () => {
    albumFindUnique.mockResolvedValue({ ...existingAlbum, eventId: 3 });
    const { status } = await callPatch({ title: "Nuevo", pickupBy: "PHOTOGRAPHER" });
    expect(status).toBe(200);
    expect(albumUpdate.mock.calls[0][0].data).toEqual({ pickupBy: "PHOTOGRAPHER" });
  });

  it("álbum de evento con sólo título → 400 'No hay campos para actualizar'", async () => {
    albumFindUnique.mockResolvedValue({ ...existingAlbum, eventId: 3 });
    const { status, body } = await callPatch({ title: "Nuevo" });
    expect(status).toBe(400);
    expect(body).toEqual({ error: "No hay campos para actualizar" });
  });

  it("isPublic true se guarda junto con los demás campos", async () => {
    const { status, body } = await callPatch({ isPublic: true, title: " Hola ", showComingSoonMessage: 1 });
    expect(status).toBe(200);
    expect(albumUpdate.mock.calls[0][0].data).toEqual({ isPublic: true, title: "Hola", showComingSoonMessage: true });
    expect(body).toMatchObject({ id: 7, isPublic: true, photosCount: 3 });
    expect(appConfigFindUnique).not.toHaveBeenCalled();
  });

  it("evento que bloquea precios: mandar precio → 403 con el mensaje del organizador", async () => {
    albumFindUnique.mockResolvedValue({ ...existingAlbum, eventId: 3 });
    loadSnapshot.mockResolvedValue({ locksPhotographerDigitalPricing: true });
    const { status, body } = await callPatch({ digitalPhotoPriceCents: 9000 });
    expect(status).toBe(403);
    expect(body).toEqual({ error: "El organizador controla el precio" });
  });

  it("precio inválido (título vacío antes) → gana el error del título, como antes", async () => {
    const { status, body } = await callPatch({ title: "  ", digitalPhotoPriceCents: 100 });
    expect(status).toBe(400);
    expect(body).toEqual({ error: "El título no puede estar vacío" });
  });

  it("fotos ocultas encendidas → encola el análisis", async () => {
    ensureQueued.mockResolvedValue(4);
    const { status, body } = await callPatch({ hiddenPhotosEnabled: true });
    expect(status).toBe(200);
    expect(ensureQueued).toHaveBeenCalledWith(7);
    expect(body._hiddenAnalysisQueued).toBe(4);
  });
});

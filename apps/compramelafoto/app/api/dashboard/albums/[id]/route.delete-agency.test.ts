import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const photoDeleteMany = vi.fn();
const agencyAlbumFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findUnique: (...a: unknown[]) => albumFindUnique(...a), update: (...a: unknown[]) => albumUpdate(...a) },
    photo: { deleteMany: (...a: unknown[]) => photoDeleteMany(...a) },
    agencyAlbum: { findUnique: (...a: unknown[]) => agencyAlbumFindUnique(...a) },
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
  loadCollaborativeEventPricingSnapshot: vi.fn(),
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING: "x",
}));
vi.mock("@/lib/hidden-album/prepare-hidden-album-photos", () => ({ ensureAlbumPhotosQueuedForHiddenMode: vi.fn() }));
vi.mock("@/lib/events/event-organizer-access", () => ({ isEventOrganizerUser: vi.fn() }));
vi.mock("@/lib/albums/album-photo-stats", () => ({
  loadAlbumPhotoStats: vi.fn(),
  loadEventFolderPhotoCounts: vi.fn(),
  countActiveAlbumPhotosForAlbum: vi.fn(async () => 3),
}));
vi.mock("@/lib/album/album-list-cover", () => ({ resolveAlbumStandaloneCoverUrl: vi.fn() }));

import { DELETE } from "./route";

const call = () => DELETE({} as any, { params: Promise.resolve({ id: "50" }) } as any);

beforeEach(() => {
  for (const f of [albumFindUnique, albumUpdate, photoDeleteMany, agencyAlbumFindUnique]) f.mockReset();
  albumFindUnique.mockResolvedValue({
    id: 50, userId: 10, deletedAt: null, coverPhotoId: null,
    photos: [{ id: 1, userId: 10, originalKey: "k" }, { id: 2, userId: 99, originalKey: "k2" }],
  });
});

describe("DELETE de álbum", () => {
  it("álbum de agencia: 409 sin borrar ni transferir", async () => {
    agencyAlbumFindUnique.mockResolvedValue({ id: 1 });
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Este álbum es de tu agencia. Quitalo de la agencia en Agencias → Mi agencia antes de eliminarlo.");
    expect(photoDeleteMany).not.toHaveBeenCalled();
    expect(albumUpdate).not.toHaveBeenCalled();
  });
  it("álbum común sin fotos de otros: soft delete como siempre", async () => {
    agencyAlbumFindUnique.mockResolvedValue(null);
    albumFindUnique.mockResolvedValue({ id: 50, userId: 10, deletedAt: null, photos: [{ id: 1, userId: 10, originalKey: "k" }] });
    const res = await call();
    expect(res.status).toBe(200);
    expect(albumUpdate.mock.calls[0][0].data).toMatchObject({ isHidden: true });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const finalize = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({ Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" } }));
vi.mock("../../upload-helpers", () => ({
  ensureMpConnected: async () => ({ ok: true }),
  ensureAlbumUploadAccess: async () => ({ ok: true, error: null, status: 200, albumEventId: null }),
  isPhotoFolderValidationError: () => false,
  resolvePhotoUploadFolders: async () => ({}),
}));
vi.mock("@/lib/albums/finalize-album-photo-from-raw", () => ({ finalizeAlbumPhotoFromRaw: (...a: unknown[]) => finalize(...a) }));
vi.mock("@/lib/albums/album-photo-upload-limits", () => ({ getAlbumPhotoMaxBytes: () => 10_000_000, getAlbumPhotoMaxMb: () => 10 }));

import { POST } from "./route";

const req = (body: unknown) => ({ json: async () => body }) as any;
const ctx = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 20 } });
  finalize.mockReset().mockResolvedValue({ photo: { id: 1, previewUrl: "p", originalKey: "o" }, duplicate: false });
});

describe("complete con datos de agencia", () => {
  it("pasa el punto declarado y el nombre original", async () => {
    const res = await POST(req({ key: "albums/5/raw/x.jpg", declaredLat: "-38,1", declaredLng: -57.6, originalName: "DSC_0001.JPG" }), ctx);
    expect(res.status).toBe(201);
    expect(finalize.mock.calls[0][0]).toMatchObject({ declaredPoint: { lat: -38.1, lng: -57.6 }, originalFilename: "DSC_0001.JPG" });
  });
  it("punto inválido se ignora sin romper", async () => {
    const res = await POST(req({ key: "albums/5/raw/x.jpg", declaredLat: 200, declaredLng: "abc" }), ctx);
    expect(res.status).toBe(201);
    expect(finalize.mock.calls[0][0].declaredPoint).toBe(null);
  });
  it("repetida: 200 con duplicate true", async () => {
    finalize.mockResolvedValue({ photo: { id: 7, previewUrl: "p", originalKey: "o" }, duplicate: true });
    const res = await POST(req({ key: "albums/5/raw/x.jpg" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photo: { id: 7, previewUrl: "p", originalKey: "o" }, duplicate: true });
  });
  it("sin datos nuevos responde como siempre", async () => {
    const res = await POST(req({ key: "albums/5/raw/x.jpg" }), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ photo: { id: 1, previewUrl: "p", originalKey: "o" } });
  });
});

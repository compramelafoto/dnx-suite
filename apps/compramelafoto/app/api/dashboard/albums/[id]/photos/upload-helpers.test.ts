import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindUnique = vi.fn();
const checkAgencyAlbumUpload = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { album: { findUnique: (...a: unknown[]) => albumFindUnique(...a) } } }));
vi.mock("@/lib/agencies/access", () => ({
  checkAgencyAlbumUpload: (...a: unknown[]) => checkAgencyAlbumUpload(...a),
}));

import { ensureAlbumUploadAccess } from "./upload-helpers";

beforeEach(() => {
  albumFindUnique.mockReset();
  checkAgencyAlbumUpload.mockReset();
});

describe("ensureAlbumUploadAccess con agencias", () => {
  it("álbum de agencia público: un extraño no puede subir aunque sea público", async () => {
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: true, isHidden: false, eventId: null });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
    expect(await ensureAlbumUploadAccess(1, 20)).toEqual({
      ok: false,
      error: "Este álbum es de una agencia: sólo su equipo puede subir fotos.",
      status: 403,
    });
  });
  it("álbum de agencia: miembro activo puede aunque el álbum esté oculto", async () => {
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: false, isHidden: true, eventId: null });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    expect(await ensureAlbumUploadAccess(1, 20)).toEqual({ ok: true, error: null, status: 200, albumEventId: null });
  });
  it("álbum común: comportamiento de siempre", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: false });
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: true, isHidden: false, eventId: 4 });
    expect(await ensureAlbumUploadAccess(1, 20)).toEqual({ ok: true, error: null, status: 200, albumEventId: 4 });
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: false, isHidden: false, eventId: null });
    expect((await ensureAlbumUploadAccess(1, 20)).ok).toBe(false);
  });
});

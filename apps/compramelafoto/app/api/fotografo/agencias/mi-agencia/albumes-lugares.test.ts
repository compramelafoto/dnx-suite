import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOwnedAgency = vi.fn();
const albumFindFirst = vi.fn();
const albumFindMany = vi.fn();
const agencyAlbumFindMany = vi.fn();
const agencyAlbumFindFirst = vi.fn();
const agencyAlbumCreate = vi.fn();
const agencyAlbumDeleteMany = vi.fn();
const photoCount = vi.fn();
const placeFindMany = vi.fn();
const placeCreate = vi.fn();
const placeDeleteMany = vi.fn();
vi.mock("@/lib/agencies/owner-auth", () => ({ requireOwnedAgency: (...a: unknown[]) => requireOwnedAgency(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findFirst: (...a: unknown[]) => albumFindFirst(...a), findMany: (...a: unknown[]) => albumFindMany(...a) },
    photo: { count: (...a: unknown[]) => photoCount(...a) },
    agencyAlbum: {
      findMany: (...a: unknown[]) => agencyAlbumFindMany(...a),
      findFirst: (...a: unknown[]) => agencyAlbumFindFirst(...a),
      create: (...a: unknown[]) => agencyAlbumCreate(...a),
      deleteMany: (...a: unknown[]) => agencyAlbumDeleteMany(...a),
    },
    agencyPlace: {
      findMany: (...a: unknown[]) => placeFindMany(...a),
      create: (...a: unknown[]) => placeCreate(...a),
      deleteMany: (...a: unknown[]) => placeDeleteMany(...a),
    },
  },
}));

import * as albumes from "./albumes/route";
import * as lugares from "./lugares/route";

const req = (body: unknown, url = "http://x/api") => ({ json: async () => body, nextUrl: new URL(url) }) as any;

beforeEach(() => {
  for (const f of [requireOwnedAgency, albumFindFirst, albumFindMany, agencyAlbumFindMany, agencyAlbumFindFirst, agencyAlbumCreate, agencyAlbumDeleteMany, photoCount, placeFindMany, placeCreate, placeDeleteMany]) f.mockReset();
  photoCount.mockResolvedValue(0);
  agencyAlbumFindFirst.mockResolvedValue({ id: 1 });
  requireOwnedAgency.mockResolvedValue({ user: { id: 10 }, agency: { id: 3 } });
});

describe("álbumes de la agencia", () => {
  it("POST vincula un álbum propio", async () => {
    albumFindFirst.mockResolvedValue({ id: 50, agencyAlbum: null });
    agencyAlbumCreate.mockResolvedValue({});
    const res = await albumes.POST(req({ albumId: 50 }));
    expect(res.status).toBe(201);
    expect(albumFindFirst.mock.calls[0][0].where).toEqual({ id: 50, userId: 10, deletedAt: null });
    expect(agencyAlbumCreate.mock.calls[0][0].data).toEqual({ agencyId: 3, albumId: 50 });
  });
  it("POST de álbum ajeno o inexistente: 404", async () => {
    albumFindFirst.mockResolvedValue(null);
    expect((await albumes.POST(req({ albumId: 50 }))).status).toBe(404);
  });
  it("POST de álbum ya vinculado: 409", async () => {
    albumFindFirst.mockResolvedValue({ id: 50, agencyAlbum: { id: 1 } });
    expect((await albumes.POST(req({ albumId: 50 }))).status).toBe(409);
  });
  it("POST sin albumId: 400", async () => {
    expect((await albumes.POST(req({}))).status).toBe(400);
  });
  it("POST con fotos de otros fotógrafos: 409 sin vincular", async () => {
    albumFindFirst.mockResolvedValue({ id: 50, agencyAlbum: null });
    photoCount.mockResolvedValue(2);
    const res = await albumes.POST(req({ albumId: 50 }));
    expect(res.status).toBe(409);
    expect(photoCount.mock.calls[0][0].where).toEqual({ albumId: 50, isRemoved: false, userId: { not: 10 } });
    expect(agencyAlbumCreate).not.toHaveBeenCalled();
  });
  it("DELETE con fotos del equipo: 409 sin desvincular", async () => {
    photoCount.mockResolvedValue(1);
    const res = await albumes.DELETE(req(null, "http://x/api?albumId=50"));
    expect(res.status).toBe(409);
    expect(agencyAlbumDeleteMany).not.toHaveBeenCalled();
  });
  it("DELETE de un álbum que no es de esta agencia no revela si tiene fotos de otros", async () => {
    agencyAlbumFindFirst.mockResolvedValue(null);
    const res = await albumes.DELETE(req(null, "http://x/api?albumId=99"));
    expect(res.status).toBe(404);
    expect(agencyAlbumFindFirst.mock.calls[0][0].where).toEqual({ agencyId: 3, albumId: 99 });
    expect(photoCount).not.toHaveBeenCalled();
  });
  it("GET ignora álbumes eliminados", async () => {
    agencyAlbumFindMany.mockResolvedValue([]);
    albumFindMany.mockResolvedValue([]);
    await albumes.GET();
    expect(agencyAlbumFindMany.mock.calls[0][0].where).toEqual({ agencyId: 3, album: { deletedAt: null } });
  });
  it("DELETE desvincula sólo de esta agencia", async () => {
    agencyAlbumDeleteMany.mockResolvedValue({ count: 1 });
    const res = await albumes.DELETE(req(null, "http://x/api?albumId=50"));
    expect(res.status).toBe(200);
    expect(agencyAlbumDeleteMany.mock.calls[0][0].where).toEqual({ agencyId: 3, albumId: 50 });
  });
});

describe("lugares", () => {
  it("POST valida nombre y coordenadas", async () => {
    expect((await lugares.POST(req({ name: "", lat: -38, lng: -57 }))).status).toBe(400);
    expect((await lugares.POST(req({ name: "Playa Grande", lat: 999, lng: -57 }))).status).toBe(400);
    placeCreate.mockResolvedValue({ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 });
    const res = await lugares.POST(req({ name: " Playa Grande ", lat: -38.02, lng: -57.53 }));
    expect(res.status).toBe(201);
    expect(placeCreate.mock.calls[0][0].data).toEqual({ agencyId: 3, name: "Playa Grande", lat: -38.02, lng: -57.53 });
  });
  it("DELETE sólo de esta agencia", async () => {
    placeDeleteMany.mockResolvedValue({ count: 0 });
    expect((await lugares.DELETE(req(null, "http://x/api?id=7"))).status).toBe(404);
    expect(placeDeleteMany.mock.calls[0][0].where).toEqual({ id: 7, agencyId: 3 });
  });
});

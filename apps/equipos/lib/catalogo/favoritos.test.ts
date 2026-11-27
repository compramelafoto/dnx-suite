import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  favFindUnique: vi.fn(),
  favFindMany: vi.fn(),
  favCreate: vi.fn(),
  favDeleteMany: vi.fn(),
  favCount: vi.fn(),
  byIds: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListing: { findFirst: m.listingFindFirst },
    gearListingFavorite: {
      findUnique: m.favFindUnique,
      findMany: m.favFindMany,
      create: m.favCreate,
      deleteMany: m.favDeleteMany,
      count: m.favCount,
    },
  },
}));
vi.mock("@/lib/catalogo/buscar", () => ({ getPublicListingsByIds: m.byIds }));

import { countFavorites, isFavorite, listFavorites, toggleFavorite } from "./favoritos";

/** Guarda los favoritos en memoria para probar el ida y vuelta del botón. */
let guardados: Set<string>;
const clave = (u: number, l: number) => `${u}:${l}`;

beforeEach(() => {
  vi.clearAllMocks();
  guardados = new Set();
  m.listingFindFirst.mockResolvedValue({ sellerId: 33 });
  m.favFindUnique.mockImplementation(async ({ where }) => {
    const { userId, listingId } = where.userId_listingId;
    return guardados.has(clave(userId, listingId)) ? { id: 1 } : null;
  });
  m.favCreate.mockImplementation(async ({ data }) => {
    guardados.add(clave(data.userId, data.listingId));
    return { id: 1 };
  });
  m.favDeleteMany.mockImplementation(async ({ where }) => {
    const existia = guardados.delete(clave(where.userId, where.listingId));
    return { count: existia ? 1 : 0 };
  });
});

describe("toggleFavorite", () => {
  it("sólo guarda publicaciones visibles: vendedor verificado y sin cuenta bloqueada", async () => {
    await toggleFavorite(7, 5);
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({
      id: 5,
      status: "PUBLISHED",
      seller: {
        identityVerification: { is: { status: "APPROVED" } },
        NOT: { portalAccountBlock: { is: { liftedAt: null } } },
      },
    });
  });

  it("vendedor bloqueado (la publicación ya no es visible) -> no la guarda", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(toggleFavorite(7, 5)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.favCreate).not.toHaveBeenCalled();
  });

  it("quitar se puede siempre, aunque ya no sea visible", async () => {
    guardados.add(clave(7, 5));
    m.listingFindFirst.mockResolvedValue(null);
    expect(await toggleFavorite(7, 5)).toEqual({ favorite: false });
  });

  it("la primera vez la guarda y la segunda la quita", async () => {
    expect(await toggleFavorite(7, 5)).toEqual({ favorite: true });
    expect(await toggleFavorite(7, 5)).toEqual({ favorite: false });
    expect(guardados.size).toBe(0);
  });

  it("no deja guardar la propia publicación", async () => {
    await expect(toggleFavorite(33, 5)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: "No podés guardar tu propia publicación.",
    });
    expect(m.favCreate).not.toHaveBeenCalled();
  });

  it("sólo se guardan publicaciones publicadas", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(toggleFavorite(7, 5)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.listingFindFirst.mock.calls[0][0].where).toMatchObject({ id: 5, status: "PUBLISHED" });
  });

  it("una que ya no está publicada igual se puede quitar", async () => {
    guardados.add(clave(7, 5));
    m.listingFindFirst.mockResolvedValue(null);
    expect(await toggleFavorite(7, 5)).toEqual({ favorite: false });
  });

  it("si otro pedido la guardó al mismo tiempo, queda guardada sin error", async () => {
    m.favCreate.mockRejectedValue({ code: "P2002" });
    expect(await toggleFavorite(7, 5)).toEqual({ favorite: true });
  });
});

describe("lecturas", () => {
  it("listFavorites devuelve sólo las publicadas, las últimas guardadas primero", async () => {
    m.favFindMany.mockResolvedValue([{ listingId: 9 }, { listingId: 5 }]);
    m.byIds.mockResolvedValue([{ id: 9 }]);
    expect(await listFavorites(7)).toEqual([{ id: 9 }]);
    expect(m.favFindMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 7 },
      orderBy: { createdAt: "desc" },
    });
    expect(m.byIds).toHaveBeenCalledWith([9, 5]);
  });

  it("isFavorite y countFavorites", async () => {
    guardados.add(clave(7, 5));
    expect(await isFavorite(7, 5)).toBe(true);
    expect(await isFavorite(8, 5)).toBe(false);
    m.favCount.mockResolvedValue(3);
    expect(await countFavorites(5)).toBe(3);
    expect(m.favCount).toHaveBeenCalledWith({ where: { listingId: 5 } });
  });
});

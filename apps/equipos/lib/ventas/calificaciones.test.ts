import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ratingCreate: vi.fn(),
  ratingFindMany: vi.fn(),
  ratingGroupBy: vi.fn(),
  ratingFindUnique: vi.fn(),
  getSale: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearSaleRating: { create: m.ratingCreate, findMany: m.ratingFindMany, groupBy: m.ratingGroupBy, findUnique: m.ratingFindUnique },
  },
}));
vi.mock("./ventas", async () => {
  const actual = await vi.importActual<typeof import("./ventas")>("./ventas");
  return { ...actual, getSaleForParty: m.getSale };
});

import {
  RATING_WINDOW_DAYS,
  formatRating,
  getUserRating,
  getUserRatings,
  hasRated,
  listRatingsAbout,
  rateSale,
} from "./calificaciones";

const DIA = 24 * 60 * 60 * 1000;

const sale = (over: Record<string, unknown> = {}) => ({
  id: 500,
  sellerId: 1,
  buyerId: 2,
  status: "CONFIRMED",
  resolvedAt: new Date(Date.now() - 2 * DIA),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.getSale.mockResolvedValue(sale());
  m.ratingCreate.mockResolvedValue({ id: 1 });
});

describe("rateSale", () => {
  it("el comprador califica al vendedor y el vendedor al comprador", async () => {
    await rateSale(2, 500, 5, "  Todo bien  ");
    expect(m.ratingCreate.mock.calls[0][0].data).toEqual({
      saleId: 500,
      raterId: 2,
      ratedId: 1,
      score: 5,
      comment: "Todo bien",
    });
    await rateSale(1, 500, 4);
    expect(m.ratingCreate.mock.calls[1][0].data).toMatchObject({ raterId: 1, ratedId: 2, score: 4, comment: null });
  });

  it("un tercero (no es parte) no puede calificar", async () => {
    m.getSale.mockResolvedValue(null);
    await expect(rateSale(9, 500, 5)).rejects.toMatchObject({ code: "NO_ENCONTRADA" });
    expect(m.ratingCreate).not.toHaveBeenCalled();
  });

  it("una venta pendiente no se puede calificar", async () => {
    m.getSale.mockResolvedValue(sale({ status: "PENDING_BUYER", resolvedAt: null }));
    await expect(rateSale(2, 500, 5)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
  });

  it("dentro de los 30 días sí; el día 31 no", async () => {
    expect(RATING_WINDOW_DAYS).toBe(30);
    m.getSale.mockResolvedValue(sale({ resolvedAt: new Date(Date.now() - 29 * DIA) }));
    await rateSale(2, 500, 5);
    m.getSale.mockResolvedValue(sale({ resolvedAt: new Date(Date.now() - 31 * DIA) }));
    await expect(rateSale(2, 500, 5)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
    expect(m.ratingCreate).toHaveBeenCalledOnce();
  });

  it.each([0, 6, 3.5, NaN])("%s estrellas: DATO_INVALIDO", async (score) => {
    await expect(rateSale(2, 500, score)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.ratingCreate).not.toHaveBeenCalled();
  });

  it("comentario de más de 300 caracteres: DATO_INVALIDO", async () => {
    await expect(rateSale(2, 500, 5, "a".repeat(301))).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });

  it("doble calificación: «Ya calificaste esta operación.»", async () => {
    m.ratingCreate.mockRejectedValue({ code: "P2002" });
    await expect(rateSale(2, 500, 5)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: "Ya calificaste esta operación.",
    });
  });

  it("otro error de la base se propaga", async () => {
    m.ratingCreate.mockRejectedValue(new Error("caída"));
    await expect(rateSale(2, 500, 5)).rejects.toThrow("caída");
  });
});

describe("promedios", () => {
  it("getUserRatings: una sola consulta groupBy y redondeo a un decimal", async () => {
    m.ratingGroupBy.mockResolvedValue([
      { ratedId: 1, _avg: { score: 4.4666 }, _count: { _all: 15 } },
      { ratedId: 3, _avg: { score: 5 }, _count: { _all: 1 } },
    ]);
    const r = await getUserRatings([1, 3, 4, 1]);
    expect(m.ratingGroupBy).toHaveBeenCalledOnce();
    expect(m.ratingGroupBy.mock.calls[0][0].where).toEqual({ ratedId: { in: [1, 3, 4] } });
    expect(r.get(1)).toEqual({ average: 4.5, count: 15 });
    expect(r.get(3)).toEqual({ average: 5, count: 1 });
    expect(r.get(4)).toEqual({ average: null, count: 0 });
  });

  it("getUserRatings sin ids no consulta", async () => {
    expect((await getUserRatings([])).size).toBe(0);
    expect(m.ratingGroupBy).not.toHaveBeenCalled();
  });

  it("getUserRating de una persona", async () => {
    m.ratingGroupBy.mockResolvedValue([{ ratedId: 1, _avg: { score: 4 }, _count: { _all: 2 } }]);
    expect(await getUserRating(1)).toEqual({ average: 4, count: 2 });
  });

  it("listRatingsAbout trae sólo las que tienen comentario", async () => {
    m.ratingFindMany.mockResolvedValue([
      { id: 1, score: 5, comment: "Excelente", createdAt: new Date("2026-11-01"), rater: { name: "ana pérez" } },
    ]);
    const r = await listRatingsAbout(1);
    expect(m.ratingFindMany.mock.calls[0][0].where).toEqual({ ratedId: 1, comment: { not: null } });
    expect(r).toEqual([{ id: 1, score: 5, comment: "Excelente", createdAt: new Date("2026-11-01"), de: "Ana" }]);
  });
});

describe("formatRating", () => {
  it("los tres textos, con coma decimal", () => {
    expect(formatRating({ average: 4.5, count: 12 })).toBe("4,5 ★ (12 calificaciones)");
    expect(formatRating({ average: 5, count: 1 })).toBe("5 ★ (1 calificación)");
    expect(formatRating({ average: null, count: 0 })).toBe("Sin calificaciones todavía");
  });
});

describe("hasRated", () => {
  it("busca por venta y por quien califica", async () => {
    m.ratingFindUnique.mockResolvedValueOnce({ id: 9 }).mockResolvedValueOnce(null);
    expect(await hasRated(2, 500)).toBe(true);
    expect(m.ratingFindUnique.mock.calls[0][0].where).toEqual({ saleId_raterId: { saleId: 500, raterId: 2 } });
    expect(await hasRated(1, 500)).toBe(false);
  });
});

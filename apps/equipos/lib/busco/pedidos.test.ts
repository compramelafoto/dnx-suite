import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  reqCount: vi.fn(),
  reqCreate: vi.fn(),
  reqFindFirst: vi.fn(),
  reqFindMany: vi.fn(),
  reqUpdateMany: vi.fn(),
  noticeFindFirst: vi.fn(),
  noticeUpdateMany: vi.fn(),
  listingFindMany: vi.fn(),
  listingFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  byIds: vi.fn(),
  notify: vi.fn(),
  idFindUnique: vi.fn(),
  noticeFindMany: vi.fn(),
  settingsUpsert: vi.fn(),
  rating: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    purchaseRequest: {
      count: m.reqCount,
      create: m.reqCreate,
      findFirst: m.reqFindFirst,
      findMany: m.reqFindMany,
      updateMany: m.reqUpdateMany,
    },
    purchaseRequestNotice: {
      findFirst: m.noticeFindFirst,
      findMany: m.noticeFindMany,
      updateMany: m.noticeUpdateMany,
    },
    gearOwnerSettings: { upsert: m.settingsUpsert },
    gearListing: { findMany: m.listingFindMany, findFirst: m.listingFindFirst },
    gearItem: { findMany: m.itemFindMany },
    identityVerification: { findUnique: m.idFindUnique },
  },
}));
vi.mock("@/lib/catalogo/buscar", () => ({
  getPublicListingsByIds: m.byIds,
  sellerFirstName: (n: string | null) => n?.trim().split(/\s+/)[0] || "Vendedor",
}));
vi.mock("@/lib/ventas/calificaciones", () => ({ getUserRating: m.rating }));
vi.mock("./cruce", () => ({ notifyRequestBuyers: m.notify }));

import {
  CANCEL_LIMIT,
  MAX_ACTIVE_REQUESTS,
  MENSAJE_MAXIMO_PEDIDOS,
  MENSAJE_MUCHOS_CANCELADOS,
  cancelRequest,
  createPurchaseRequest,
  getNoticeForOwner,
  getRequestMatches,
  isNoticeForItem,
  listMyRequests,
  renewRequest,
  respondNotice,
  setPurchaseRequestOptOut,
} from "./pedidos";

const HOY = new Date("2026-11-27T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const input = { kind: "LENS" as const, make: "Sony", model: "FE 20mm F1.8 G" };

/** Cuántos activos y cuántos cancelados en 30 días devuelven los dos `count`. */
function conteos(activos: number, cancelados: number) {
  m.reqCount.mockImplementation(async ({ where }) =>
    where.status === "ACTIVE" ? activos : cancelados,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
  conteos(0, 0);
  m.reqCreate.mockResolvedValue({ id: 41 });
  m.listingFindMany.mockResolvedValue([]);
  m.byIds.mockResolvedValue([]);
  m.notify.mockResolvedValue(undefined);
  m.idFindUnique.mockResolvedValue({ status: "APPROVED" });
});

describe("createPurchaseRequest", () => {
  it("guarda el pedido con su clave de modelo y vence a los 30 días", async () => {
    expect(
      await createPurchaseRequest(7, {
        ...input,
        maxPriceArs: 900000,
        minCondition: "VERY_GOOD",
        province: "Córdoba",
      }),
    ).toEqual({ requestId: 41, matches: [] });
    expect(m.reqCreate).toHaveBeenCalledWith({
      data: {
        buyerId: 7,
        kind: "LENS",
        make: "Sony",
        model: "FE 20mm F1.8 G",
        modelKey: "sony:fe20mmf18g",
        maxPriceArs: 900000,
        minCondition: "VERY_GOOD",
        province: "Córdoba",
        status: "ACTIVE",
        expiresAt: new Date(HOY.getTime() + 30 * DIA),
      },
      select: { id: true },
    });
  });

  it.each([
    [{ ...input, kind: "AUTO" }],
    [{ ...input, make: "  " }],
    [{ ...input, model: "" }],
    [{ ...input, model: "x".repeat(121) }],
    [{ ...input, maxPriceArs: 0 }],
    [{ ...input, maxPriceArs: 10.5 }],
    [{ ...input, minCondition: "ROTO" }],
    [{ ...input, province: "Narnia" }],
  ])("datos inválidos -> DATO_INVALIDO (%#)", async (bad) => {
    await expect(createPurchaseRequest(7, bad as never)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
    });
    expect(m.reqCreate).not.toHaveBeenCalled();
  });

  it.each([[null], [{ status: "PENDING" }], [{ status: "REJECTED" }]])(
    "sin identidad aprobada hoy -> error y no crea nada (%#)",
    async (verif) => {
      m.idFindUnique.mockResolvedValue(verif);
      await expect(createPurchaseRequest(7, input)).rejects.toMatchObject({
        code: "DATO_INVALIDO",
        message: "Para crear un pedido necesitás tener tu identidad verificada.",
      });
      expect(m.idFindUnique).toHaveBeenCalledWith({
        where: { userId: 7 },
        select: { status: true },
      });
      expect(m.reqCreate).not.toHaveBeenCalled();
    },
  );

  it("el sexto pedido activo -> error", async () => {
    conteos(MAX_ACTIVE_REQUESTS, 0);
    await expect(createPurchaseRequest(7, input)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: MENSAJE_MAXIMO_PEDIDOS,
    });
    expect(m.reqCount).toHaveBeenCalledWith({
      where: { buyerId: 7, status: "ACTIVE", expiresAt: { gt: HOY } },
    });
    expect(m.reqCreate).not.toHaveBeenCalled();
  });

  it("con 5 cancelados en 30 días -> error con el texto del encargo", async () => {
    conteos(0, CANCEL_LIMIT);
    await expect(createPurchaseRequest(7, input)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: "Cancelaste muchos pedidos en poco tiempo. Vas a poder crear otro en unos días.",
    });
    expect(MENSAJE_MUCHOS_CANCELADOS).toBe(
      "Cancelaste muchos pedidos en poco tiempo. Vas a poder crear otro en unos días.",
    );
    expect(m.reqCount).toHaveBeenCalledWith({
      where: { buyerId: 7, status: "CANCELLED", cancelledAt: { gte: new Date(HOY.getTime() - 30 * DIA) } },
    });
    expect(m.reqCreate).not.toHaveBeenCalled();
  });

  it("con 4 cancelados todavía puede", async () => {
    conteos(4, CANCEL_LIMIT - 1);
    await expect(createPurchaseRequest(7, input)).resolves.toMatchObject({ requestId: 41 });
  });

  it("matches: sólo publicaciones del mismo modelo, nunca las propias, con el armado del catálogo", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: 10, make: "SONY", model: "Sony FE 20mm f/1.8 G" },
      { id: 11, make: "Sony", model: "FE 24mm F1.4 GM" },
      { id: 12, make: "Sony Corporation", model: "FE 20mm F1.8 G" },
    ]);
    const publica = { id: 10, make: "SONY", sellerFirstName: "Ana" };
    m.byIds.mockResolvedValue([publica]);
    const r = await createPurchaseRequest(7, input);
    expect(m.byIds).toHaveBeenCalledWith([10, 12]);
    expect(r.matches).toEqual([publica]);
    const where = m.listingFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "PUBLISHED", kind: "LENS", sellerId: { not: 7 } });
  });

  it("no trae nada de inventarios ni de dueños", async () => {
    m.listingFindMany.mockResolvedValue([{ id: 10, make: "Sony", model: "FE 20mm F1.8 G" }]);
    m.byIds.mockResolvedValue([{ id: 10 }]);
    const r = await createPurchaseRequest(7, input);
    expect(Object.keys(r).sort()).toEqual(["matches", "requestId"]);
    expect(m.itemFindMany).not.toHaveBeenCalled();
    const select = m.listingFindMany.mock.calls[0][0].select;
    expect(select).toEqual({ id: true, make: true, model: true });
  });
});

describe("renewRequest", () => {
  it("activo o vencido: +30 días desde hoy y vuelve a activo", async () => {
    m.reqFindFirst.mockResolvedValue({ id: 3, status: "EXPIRED" });
    m.reqUpdateMany.mockResolvedValue({ count: 1 });
    await renewRequest(7, 3);
    expect(m.reqFindFirst).toHaveBeenCalledWith({
      where: { id: 3, buyerId: 7 },
      select: { id: true, status: true },
    });
    expect(m.reqUpdateMany).toHaveBeenCalledWith({
      where: { id: 3, buyerId: 7, status: { in: ["ACTIVE", "EXPIRED"] } },
      data: { status: "ACTIVE", expiresAt: new Date(HOY.getTime() + 30 * DIA) },
    });
  });

  it("renovar uno vencido respeta el tope de activos", async () => {
    m.reqFindFirst.mockResolvedValue({ id: 3, status: "EXPIRED" });
    conteos(MAX_ACTIVE_REQUESTS, 0);
    await expect(renewRequest(7, 3)).rejects.toMatchObject({ message: MENSAJE_MAXIMO_PEDIDOS });
    expect(m.reqUpdateMany).not.toHaveBeenCalled();
  });

  it("ajeno -> NO_ENCONTRADO; cancelado o cumplido -> DATO_INVALIDO", async () => {
    m.reqFindFirst.mockResolvedValue(null);
    await expect(renewRequest(7, 3)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    m.reqFindFirst.mockResolvedValue({ id: 3, status: "CANCELLED" });
    await expect(renewRequest(7, 3)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.reqUpdateMany).not.toHaveBeenCalled();
  });
});

describe("cancelRequest", () => {
  it("cancela sólo un pedido propio y activo", async () => {
    m.reqUpdateMany.mockResolvedValue({ count: 1 });
    await cancelRequest(7, 3);
    expect(m.reqUpdateMany).toHaveBeenCalledWith({
      where: { id: 3, buyerId: 7, status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: HOY },
    });
  });

  it("ajeno -> NO_ENCONTRADO; ya no activo -> DATO_INVALIDO", async () => {
    m.reqUpdateMany.mockResolvedValue({ count: 0 });
    m.reqFindFirst.mockResolvedValue(null);
    await expect(cancelRequest(7, 3)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    m.reqFindFirst.mockResolvedValue({ id: 3 });
    await expect(cancelRequest(7, 3)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });
});

describe("listMyRequests", () => {
  it("sus pedidos sin conteos de avisos; un activo ya vencido se muestra vencido", async () => {
    m.reqFindMany.mockResolvedValue([
      { id: 1, status: "ACTIVE", expiresAt: new Date(HOY.getTime() + DIA) },
      { id: 2, status: "ACTIVE", expiresAt: new Date(HOY.getTime() - DIA) },
    ]);
    const r = await listMyRequests(7);
    expect(r.map((p) => p.status)).toEqual(["ACTIVE", "EXPIRED"]);
    const q = m.reqFindMany.mock.calls[0][0];
    expect(q.where).toEqual({ buyerId: 7 });
    expect(JSON.stringify(q.select)).not.toMatch(/notice|_count/i);
    // Sin pedidos cumplidos no se mira ningún aviso.
    expect(m.noticeFindMany).not.toHaveBeenCalled();
    expect(r.map((p) => p.listingId)).toEqual([null, null]);
  });

  it("un pedido cumplido trae sólo la publicación que lo cumplió", async () => {
    m.reqFindMany.mockResolvedValue([
      { id: 1, status: "FULFILLED", expiresAt: new Date(HOY.getTime() + DIA) },
      { id: 2, status: "CANCELLED", expiresAt: new Date(HOY.getTime() + DIA) },
      { id: 3, status: "FULFILLED", expiresAt: new Date(HOY.getTime() + DIA) },
    ]);
    m.noticeFindMany.mockResolvedValue([{ requestId: 1, listingId: 77 }]);
    const r = await listMyRequests(7);
    expect(r.map((p) => p.listingId)).toEqual([77, null, null]);
    const q = m.noticeFindMany.mock.calls[0][0];
    expect(q.where).toEqual({ requestId: { in: [1, 3] }, listingId: { not: null } });
    expect(q.select).toEqual({ requestId: true, listingId: true });
    expect(Object.keys(r[0])).not.toContain("ownerId");
  });
});

describe("getNoticeForOwner", () => {
  const fila = (identidad: { status: string; legalName: string | null } | null) => ({
    id: 5,
    gearItemId: 30,
    sentAt: HOY,
    response: null,
    respondedAt: null,
    listingId: null,
    gearItem: { make: "Sony", model: "FE 20mm F1.8 G" },
    request: {
      buyerId: 9,
      kind: "LENS",
      make: "Sony",
      model: "FE 20mm",
      maxPriceArs: 900000,
      minCondition: null,
      province: "Córdoba",
      status: "ACTIVE",
      expiresAt: new Date(HOY.getTime() + DIA),
      buyer: { name: "ana maría pérez", identityVerification: identidad },
    },
  });

  it("de otro dueño no existe", async () => {
    m.noticeFindFirst.mockResolvedValue(null);
    expect(await getNoticeForOwner(8, 5)).toBeNull();
    expect(m.noticeFindFirst.mock.calls[0][0].where).toEqual({ id: 5, ownerId: 8 });
    expect(await getNoticeForOwner(8, Number.NaN)).toBeNull();
  });

  it("el dueño ve el nombre del DNI y la calificación del comprador", async () => {
    m.noticeFindFirst.mockResolvedValue(fila({ status: "APPROVED", legalName: " Ana María Pérez " }));
    m.rating.mockResolvedValue({ average: 4.5, count: 2 });
    const n = await getNoticeForOwner(8, 5);
    expect(n).toMatchObject({
      buyerName: "Ana María Pérez",
      buyerVerified: true,
      publicado: false,
      buyerRating: { average: 4.5, count: 2 },
      request: { abierto: true, province: "Córdoba" },
    });
    expect(m.rating).toHaveBeenCalledWith(9);
    expect(n && "buyerId" in n.request).toBe(false);
  });

  it("sin identidad aprobada, sólo el nombre de pila", async () => {
    m.noticeFindFirst.mockResolvedValue(fila({ status: "REJECTED", legalName: "Ana María Pérez" }));
    m.rating.mockResolvedValue({ average: null, count: 0 });
    expect(await getNoticeForOwner(8, 5)).toMatchObject({ buyerName: "ana", buyerVerified: false });
  });
});

describe("getRequestMatches", () => {
  it("sólo de un pedido propio, con publicaciones del catálogo y no las del comprador", async () => {
    m.reqFindFirst.mockResolvedValue(null);
    expect(await getRequestMatches(7, 41)).toBeNull();
    expect(m.reqFindFirst.mock.calls[0][0].where).toEqual({ id: 41, buyerId: 7 });

    m.reqFindFirst.mockResolvedValue({
      kind: "LENS",
      make: "Sony",
      model: "FE 20mm F1.8 G",
      modelKey: "sony:fe20mmf18g",
    });
    m.listingFindMany.mockResolvedValue([
      { id: 10, make: "SONY", model: "Sony FE 20mm f/1.8 G" },
      { id: 11, make: "Sony", model: "FE 24mm F1.4 GM" },
    ]);
    m.byIds.mockResolvedValue([{ id: 10 }]);
    expect(await getRequestMatches(7, 41)).toEqual({
      make: "Sony",
      model: "FE 20mm F1.8 G",
      matches: [{ id: 10 }],
    });
    expect(m.listingFindMany.mock.calls[0][0].where.sellerId).toEqual({ not: 7 });
    expect(m.byIds).toHaveBeenCalledWith([10]);
  });
});

describe("isNoticeForItem", () => {
  it("sólo si el aviso es del dueño y del mismo equipo", async () => {
    m.noticeFindFirst.mockResolvedValue({ id: 5 });
    expect(await isNoticeForItem(8, 5, 30)).toBe(true);
    expect(m.noticeFindFirst.mock.calls[0][0].where).toEqual({ id: 5, ownerId: 8, gearItemId: 30 });
    m.noticeFindFirst.mockResolvedValue(null);
    expect(await isNoticeForItem(8, 5, 31)).toBe(false);
  });
});

describe("setPurchaseRequestOptOut", () => {
  it("crea o actualiza la preferencia", async () => {
    await setPurchaseRequestOptOut(8, true);
    expect(m.settingsUpsert).toHaveBeenCalledWith({
      where: { userId: 8 },
      create: { userId: 8, purchaseRequestOptOut: true },
      update: { purchaseRequestOptOut: true },
    });
  });
});

describe("respondNotice", () => {
  it("el aviso de otro dueño -> NO_ENCONTRADO", async () => {
    m.noticeFindFirst.mockResolvedValue(null);
    await expect(respondNotice(8, 5, "INTERESTED")).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.noticeFindFirst.mock.calls[0][0].where).toEqual({ id: 5, ownerId: 8 });
    expect(m.noticeUpdateMany).not.toHaveBeenCalled();
  });

  it("responde una sola vez", async () => {
    m.noticeFindFirst.mockResolvedValue({ gearItemId: 30, response: "DECLINED" });
    await expect(respondNotice(8, 5, "INTERESTED")).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    m.noticeFindFirst.mockResolvedValue({ gearItemId: 30, response: null });
    m.noticeUpdateMany.mockResolvedValue({ count: 0 });
    await expect(respondNotice(8, 5, "INTERESTED")).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });

  it("registra la respuesta y devuelve el equipo", async () => {
    m.noticeFindFirst.mockResolvedValue({ gearItemId: 30, response: null });
    m.noticeUpdateMany.mockResolvedValue({ count: 1 });
    m.listingFindFirst.mockResolvedValue(null);
    expect(await respondNotice(8, 5, "DECLINED")).toEqual({ gearItemId: 30, yaPublicado: false });
    expect(m.noticeUpdateMany).toHaveBeenCalledWith({
      where: { id: 5, ownerId: 8, response: null },
      data: { response: "DECLINED", respondedAt: HOY },
    });
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("si ya tenía ese equipo publicado, «Me interesa» avisa al comprador enseguida", async () => {
    m.noticeFindFirst.mockResolvedValue({ gearItemId: 30, response: null });
    m.noticeUpdateMany.mockResolvedValue({ count: 1 });
    m.listingFindFirst.mockResolvedValue({ id: 77 });
    expect(await respondNotice(8, 5, "INTERESTED")).toEqual({ gearItemId: 30, yaPublicado: true });
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({
      gearItemId: 30,
      sellerId: 8,
      status: "PUBLISHED",
    });
    expect(m.notify).toHaveBeenCalledWith(77);
  });

  it("una respuesta desconocida -> DATO_INVALIDO", async () => {
    await expect(respondNotice(8, 5, "QUIZAS" as never)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
    });
  });
});

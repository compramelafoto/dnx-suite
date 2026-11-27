import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  contactFindUnique: vi.fn(),
  saleFindFirst: vi.fn(),
  saleFindMany: vi.fn(),
  userFindMany: vi.fn(),
  txListingUpdateMany: vi.fn(),
  txSaleCreate: vi.fn(),
  txSaleUpdateMany: vi.fn(),
  txItemUpdateMany: vi.fn(),
  txEventCreate: vi.fn(),
  tx: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListing: { findFirst: m.listingFindFirst },
    gearListingContact: { findUnique: m.contactFindUnique },
    gearSale: { findFirst: m.saleFindFirst, findMany: m.saleFindMany },
    user: { findMany: m.userFindMany },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import {
  SALE_DAYS,
  confirmPurchase,
  declinePurchase,
  expirePendingSales,
  getSaleForParty,
  listMyPurchases,
  listMySales,
  markSold,
} from "./ventas";

const DIA = 24 * 60 * 60 * 1000;
const FUTURO = new Date(Date.now() + 3 * DIA);
const PASADO = new Date(Date.now() - DIA);

const listing = (over: Record<string, unknown> = {}) => ({
  id: 70,
  sellerId: 1,
  gearItemId: 7,
  status: "PUBLISHED",
  make: "Canon",
  model: "R5",
  ...over,
});

const sale = (over: Record<string, unknown> = {}) => ({
  id: 500,
  listingId: 70,
  gearItemId: 7,
  sellerId: 1,
  buyerId: 2,
  status: "PENDING_BUYER",
  priceArs: 1500000,
  expiresAt: FUTURO,
  listing: { make: "Canon", model: "R5" },
  ...over,
});

const usuarios = [
  { id: 1, email: "vende@e.test", name: "Ana Pérez" },
  { id: 2, email: "compra@e.test", name: "Beto Gómez" },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      gearListing: { updateMany: m.txListingUpdateMany },
      gearSale: { create: m.txSaleCreate, updateMany: m.txSaleUpdateMany },
      gearItem: { updateMany: m.txItemUpdateMany },
      gearItemEvent: { create: m.txEventCreate },
    }),
  );
  m.listingFindFirst.mockResolvedValue(listing());
  m.contactFindUnique.mockResolvedValue({ id: 1 });
  m.userFindMany.mockResolvedValue(usuarios);
  m.txListingUpdateMany.mockResolvedValue({ count: 1 });
  m.txSaleCreate.mockResolvedValue({ id: 500 });
  m.txSaleUpdateMany.mockResolvedValue({ count: 1 });
  m.txItemUpdateMany.mockResolvedValue({ count: 1 });
  m.txEventCreate.mockResolvedValue({});
  m.email.mockResolvedValue({ success: true });
  m.saleFindFirst.mockResolvedValue(sale());
  m.saleFindMany.mockResolvedValue([]);
});

describe("markSold", () => {
  it("marca la publicación como vendida, crea la venta con vencimiento a 7 días y avisa al comprador", async () => {
    expect(SALE_DAYS).toBe(7);
    const antes = Date.now();
    const r = await markSold(1, 70, 2, 1500000);
    expect(r).toEqual({ saleId: 500 });

    const lu = m.txListingUpdateMany.mock.calls[0][0];
    expect(lu.where).toEqual({ id: 70, sellerId: 1, status: "PUBLISHED" });
    expect(lu.data.status).toBe("SOLD");
    expect(lu.data.closedAt).toBeInstanceOf(Date);

    const created = m.txSaleCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ listingId: 70, gearItemId: 7, sellerId: 1, buyerId: 2, priceArs: 1500000 });
    const expires = (created.expiresAt as Date).getTime();
    expect(expires).toBeGreaterThanOrEqual(antes + 7 * DIA);
    expect(expires).toBeLessThanOrEqual(Date.now() + 7 * DIA);

    expect(m.txEventCreate.mock.calls[0][0].data).toEqual({
      gearItemId: 7,
      type: "STATUS_CHANGED",
      detail: { listingId: 70, accion: "vendido_pendiente", saleId: 500 },
    });

    expect(m.email).toHaveBeenCalledTimes(1);
    const [to, template, data] = m.email.mock.calls[0];
    expect(to).toBe("compra@e.test");
    expect(template).toBe("confirmar_compra");
    expect(data).toMatchObject({
      vendedor: "Ana",
      equipo: "Canon R5",
      precio: "$ 1.500.000",
      url: "https://e.test/compras/500",
    });
    expect(data.vence).toBeTruthy();
  });

  it("acepta publicaciones pausadas y condiciona el cambio al estado leído", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PAUSED" }));
    await markSold(1, 70, 2, 1000);
    expect(m.txListingUpdateMany.mock.calls[0][0].where.status).toBe("PAUSED");
  });

  it("publicación ajena o inexistente → NO_ENCONTRADA", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(markSold(9, 70, 2, 1000)).rejects.toMatchObject({ code: "NO_ENCONTRADA" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("publicación ya vendida → YA_VENDIDA; en otro estado → NO_ENCONTRADA", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "SOLD" }));
    await expect(markSold(1, 70, 2, 1000)).rejects.toMatchObject({ code: "YA_VENDIDA" });
    m.listingFindFirst.mockResolvedValue(listing({ status: "CLOSED" }));
    await expect(markSold(1, 70, 2, 1000)).rejects.toMatchObject({ code: "NO_ENCONTRADA" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("a quien no consultó → NO_CONSULTO, sin transacción ni correo", async () => {
    m.contactFindUnique.mockResolvedValue(null);
    await expect(markSold(1, 70, 2, 1000)).rejects.toMatchObject({ code: "NO_CONSULTO" });
    expect(m.tx).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1500.5, Number.NaN])("precio inválido %s → error y nada se toca", async (precio) => {
    await expect(markSold(1, 70, 2, precio)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("segundo markSold: updateMany devuelve 0 → YA_VENDIDA y ningún correo", async () => {
    m.txListingUpdateMany.mockResolvedValue({ count: 0 });
    await expect(markSold(1, 70, 2, 1000)).rejects.toMatchObject({ code: "YA_VENDIDA" });
    expect(m.txSaleCreate).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("si el correo falla, la venta igual queda registrada", async () => {
    m.email.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(markSold(1, 70, 2, 1000)).resolves.toEqual({ saleId: 500 });
    spy.mockRestore();
  });
});

describe("confirmPurchase", () => {
  it("pasa el equipo al comprador y borra notas y valores en la misma transacción", async () => {
    await confirmPurchase(2, 500);

    const su = m.txSaleUpdateMany.mock.calls[0][0];
    expect(su.where).toMatchObject({ id: 500, buyerId: 2, status: "PENDING_BUYER" });
    expect(su.data.status).toBe("CONFIRMED");
    expect(su.data.resolvedAt).toBeInstanceOf(Date);

    const iu = m.txItemUpdateMany.mock.calls[0][0];
    expect(iu.where).toEqual({ id: 7, status: "FOR_SALE", ownerId: 1 });
    expect(iu.data).toEqual({
      ownerId: 2,
      status: "IN_USE",
      notes: null,
      declaredValueArs: null,
      declaredValueUsd: null,
      sightingId: null,
    });
    expect(m.txEventCreate.mock.calls[0][0].data).toEqual({
      gearItemId: 7,
      type: "STATUS_CHANGED",
      detail: { accion: "traspaso", saleId: 500 },
    });
    expect(m.tx).toHaveBeenCalledTimes(1);
  });

  it("avisa a comprador y vendedor", async () => {
    await confirmPurchase(2, 500);
    expect(m.email).toHaveBeenCalledTimes(2);
    const aQuien = m.email.mock.calls.map((c) => c[0]).sort();
    expect(aQuien).toEqual(["compra@e.test", "vende@e.test"]);
    expect(m.email.mock.calls.every((c) => c[1] === "venta_confirmada")).toBe(true);
  });

  it("venta DECLINED → NO_PENDIENTE sin tocar el equipo", async () => {
    m.saleFindFirst.mockResolvedValue(sale({ status: "DECLINED" }));
    await expect(confirmPurchase(2, 500)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
    expect(m.tx).not.toHaveBeenCalled();
    expect(m.txItemUpdateMany).not.toHaveBeenCalled();
  });

  it("vencida → VENCIDA", async () => {
    m.saleFindFirst.mockResolvedValue(sale({ expiresAt: PASADO }));
    await expect(confirmPurchase(2, 500)).rejects.toMatchObject({ code: "VENCIDA" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("un tercero (o venta inexistente) → NO_ENCONTRADA, y la búsqueda filtra por comprador", async () => {
    m.saleFindFirst.mockResolvedValue(null);
    await expect(confirmPurchase(99, 500)).rejects.toMatchObject({ code: "NO_ENCONTRADA" });
    expect(m.saleFindFirst.mock.calls[0][0].where).toEqual({ id: 500, buyerId: 99 });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("dos confirmaciones a la vez: updateMany devuelve 0 → NO_PENDIENTE, sin traspaso ni correo", async () => {
    m.txSaleUpdateMany.mockResolvedValue({ count: 0 });
    await expect(confirmPurchase(2, 500)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
    expect(m.txItemUpdateMany).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("equipo ya no está a la venta (denunciado mientras tanto) → NO_PENDIENTE, sin evento ni correo", async () => {
    m.txItemUpdateMany.mockResolvedValue({ count: 0 });
    await expect(confirmPurchase(2, 500)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
    expect(m.txEventCreate).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("declinePurchase", () => {
  it("rechaza: publicación SOLD→CLOSED, equipo vuelve a IN_USE con el vendedor y avisa al vendedor", async () => {
    await declinePurchase(2, 500);

    const su = m.txSaleUpdateMany.mock.calls[0][0];
    expect(su.where).toMatchObject({ id: 500, status: "PENDING_BUYER" });
    expect(su.data.status).toBe("DECLINED");
    expect(su.data.resolvedAt).toBeInstanceOf(Date);

    expect(m.txListingUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 70, status: "SOLD" },
      data: { status: "CLOSED" },
    });
    expect(m.txItemUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 7, status: "FOR_SALE", ownerId: 1 },
      data: { status: "IN_USE" },
    });
    expect(m.txEventCreate.mock.calls[0][0].data).toEqual({
      gearItemId: 7,
      type: "STATUS_CHANGED",
      detail: { accion: "venta_no_confirmada", saleId: 500 },
    });
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.email.mock.calls[0][0]).toBe("vende@e.test");
    expect(m.email.mock.calls[0][1]).toBe("venta_no_confirmada");
  });

  it("no pisa un equipo denunciado: si ya no está FOR_SALE, el equipo no se toca y no falla", async () => {
    m.txItemUpdateMany.mockResolvedValue({ count: 0 });
    await expect(declinePurchase(2, 500)).resolves.toBeUndefined();
  });

  it("tercero → NO_ENCONTRADA; ya resuelta → NO_PENDIENTE", async () => {
    m.saleFindFirst.mockResolvedValue(null);
    await expect(declinePurchase(99, 500)).rejects.toMatchObject({ code: "NO_ENCONTRADA" });
    m.saleFindFirst.mockResolvedValue(sale({ status: "CONFIRMED" }));
    await expect(declinePurchase(2, 500)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("carrera: updateMany devuelve 0 → NO_PENDIENTE y ningún correo", async () => {
    m.txSaleUpdateMany.mockResolvedValue({ count: 0 });
    await expect(declinePurchase(2, 500)).rejects.toMatchObject({ code: "NO_PENDIENTE" });
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("expirePendingSales", () => {
  const ahora = new Date("2026-12-10T12:00:00Z");

  it("vence las pendientes con expiresAt pasado: EXPIRED, mismo efecto que rechazar y correo al vendedor", async () => {
    m.saleFindMany.mockResolvedValueOnce([sale({ expiresAt: PASADO })]);
    const r = await expirePendingSales(ahora);
    expect(r).toEqual({ expired: 1 });
    expect(m.saleFindMany.mock.calls[0][0].where).toEqual({
      status: "PENDING_BUYER",
      expiresAt: { lt: ahora },
    });
    expect(m.txSaleUpdateMany.mock.calls[0][0].data.status).toBe("EXPIRED");
    expect(m.txListingUpdateMany.mock.calls[0][0].data.status).toBe("CLOSED");
    expect(m.txItemUpdateMany.mock.calls[0][0].data).toEqual({ status: "IN_USE" });
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.email.mock.calls[0][0]).toBe("vende@e.test");
  });

  it("correr dos veces no repite correos", async () => {
    m.saleFindMany.mockResolvedValueOnce([sale({ expiresAt: PASADO })]).mockResolvedValueOnce([]);
    await expirePendingSales(ahora);
    const segunda = await expirePendingSales(ahora);
    expect(segunda).toEqual({ expired: 0 });
    expect(m.email).toHaveBeenCalledTimes(1);
  });

  it("si otra corrida ya la resolvió (updateMany 0), no cuenta ni manda correo y sigue con las demás", async () => {
    m.saleFindMany.mockResolvedValueOnce([sale({ id: 501 }), sale({ id: 502 })]);
    m.txSaleUpdateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const r = await expirePendingSales(ahora);
    expect(r).toEqual({ expired: 1 });
    expect(m.email).toHaveBeenCalledTimes(1);
  });
});

describe("listados y acceso", () => {
  it("listMyPurchases muestra el nombre de pila del vendedor", async () => {
    m.saleFindMany.mockResolvedValue([
      {
        id: 500,
        status: "PENDING_BUYER",
        priceArs: 1500000,
        createdAt: new Date("2026-12-01T00:00:00Z"),
        expiresAt: FUTURO,
        resolvedAt: null,
        listing: { make: "Canon", model: "R5" },
        seller: { name: "Ana Pérez" },
      },
    ]);
    const r = await listMyPurchases(2);
    expect(m.saleFindMany.mock.calls[0][0].where).toEqual({ buyerId: 2 });
    expect(r[0]).toMatchObject({ id: 500, equipo: "Canon R5", priceArs: 1500000, status: "PENDING_BUYER", otraParte: "Ana" });
  });

  it("listMySales muestra el nombre de pila del comprador", async () => {
    m.saleFindMany.mockResolvedValue([
      {
        id: 500,
        status: "CONFIRMED",
        priceArs: 1500000,
        createdAt: new Date(),
        expiresAt: FUTURO,
        resolvedAt: new Date(),
        listing: { make: "Canon", model: "R5" },
        buyer: { name: "Beto Gómez" },
      },
    ]);
    const r = await listMySales(1);
    expect(m.saleFindMany.mock.calls[0][0].where).toEqual({ sellerId: 1 });
    expect(r[0].otraParte).toBe("Beto");
  });

  it("getSaleForParty devuelve la venta a comprador o vendedor, y null a un tercero", async () => {
    m.saleFindFirst.mockResolvedValue({
      id: 500,
      listingId: 70,
      gearItemId: 7,
      sellerId: 1,
      buyerId: 2,
      status: "PENDING_BUYER",
      priceArs: 1500000,
      createdAt: new Date(),
      expiresAt: FUTURO,
      resolvedAt: null,
      listing: { make: "Canon", model: "R5" },
      seller: { name: "Ana Pérez" },
      buyer: { name: "Beto Gómez" },
    });
    const comoComprador = await getSaleForParty(2, 500);
    expect(comoComprador).toMatchObject({ rol: "COMPRADOR", otraParte: "Ana", equipo: "Canon R5" });
    expect(m.saleFindFirst.mock.calls[0][0].where).toEqual({
      id: 500,
      OR: [{ buyerId: 2 }, { sellerId: 2 }],
    });
    const comoVendedor = await getSaleForParty(1, 500);
    expect(comoVendedor).toMatchObject({ rol: "VENDEDOR", otraParte: "Beto" });
    m.saleFindFirst.mockResolvedValue(null);
    expect(await getSaleForParty(99, 500)).toBeNull();
  });
});

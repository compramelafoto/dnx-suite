import { beforeEach, describe, expect, it, vi } from "vitest";

/** Pantalla de regalías (spec O11, §5.9) contra una base falsa: qué se lee y qué se escribe. */
const h = vi.hoisted(() => ({
  prisma: {
    artworkRoyalty: { findMany: vi.fn(), updateMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@repo/db", () => ({ prisma: h.prisma }));

const { loadRoyaltyMonth, loadRoyaltiesToRecover, markAuthorMonthPaid } = await import("./royalties");

function regalia(over: Record<string, unknown> = {}) {
  return {
    id: "r1",
    authorUserId: 10,
    orderId: "ord1",
    baseArs: { toString: () => "30000.00" },
    royaltyBps: 2000,
    amountArs: { toString: () => "6000.00" },
    status: "ACCRUED",
    createdAt: new Date("2026-10-04T15:00:00Z"),
    paidAt: null,
    paidReference: null,
    order: { orderNumber: 7, status: "PAID" },
    orderItem: { productName: "Niebla", printFormatName: "Copia", qty: 1 },
    ...over,
  };
}

beforeEach(() => {
  h.prisma.artworkRoyalty.findMany.mockReset();
  h.prisma.artworkRoyalty.updateMany.mockReset();
  h.prisma.user.findMany.mockReset();
  h.prisma.user.findMany.mockResolvedValue([
    { id: 10, name: "Nombre de cuenta", email: "autor@example.com", fotorankProfile: { displayName: "Autora Visible" } },
  ]);
});

describe("loadRoyaltyMonth", () => {
  it("lee el mes en hora argentina, sólo del workspace, y agrupa por autor con su nombre de FotoRank", async () => {
    h.prisma.artworkRoyalty.findMany.mockResolvedValue([regalia()]);
    const grupos = await loadRoyaltyMonth("ws1", "2026-10");
    expect(h.prisma.artworkRoyalty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws1",
          createdAt: { gte: new Date("2026-10-01T03:00:00Z"), lt: new Date("2026-11-01T03:00:00Z") },
        },
      }),
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      name: "Autora Visible",
      email: "autor@example.com",
      accruedMinor: 600000,
      copies: 1,
    });
    expect(grupos[0]!.items[0]).toMatchObject({ orderNumber: 7, workTitle: "Niebla", baseMinor: 3000000 });
  });

  it("sin perfil de FotoRank usa el nombre de la cuenta", async () => {
    h.prisma.artworkRoyalty.findMany.mockResolvedValue([regalia()]);
    h.prisma.user.findMany.mockResolvedValue([{ id: 10, name: "Nombre de cuenta", email: "a@b.c", fotorankProfile: null }]);
    const [g] = await loadRoyaltyMonth("ws1", "2026-10");
    expect(g!.name).toBe("Nombre de cuenta");
  });

  it("sin regalías no consulta personas", async () => {
    h.prisma.artworkRoyalty.findMany.mockResolvedValue([]);
    expect(await loadRoyaltyMonth("ws1", "2026-10")).toEqual([]);
    expect(h.prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("loadRoyaltiesToRecover", () => {
  it("son las pagadas de pedidos cancelados del workspace", async () => {
    h.prisma.artworkRoyalty.findMany.mockResolvedValue([regalia({ status: "PAID", order: { orderNumber: 9, status: "CANCELLED" } })]);
    const filas = await loadRoyaltiesToRecover("ws1");
    expect(h.prisma.artworkRoyalty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws1", status: "PAID", order: { status: "CANCELLED" } } }),
    );
    expect(filas[0]).toMatchObject({ orderNumber: 9, authorName: "Autora Visible", amountMinor: 600000 });
  });
});

describe("markAuthorMonthPaid", () => {
  it("sólo toca las ACCRUED de ese autor, ese mes y ese workspace", async () => {
    h.prisma.artworkRoyalty.updateMany.mockResolvedValue({ count: 3 });
    const ahora = new Date("2026-11-02T12:00:00Z");
    const r = await markAuthorMonthPaid({
      workspaceId: "ws1",
      authorUserId: 10,
      month: "2026-10",
      reference: "Transferencia 123",
      userId: 5,
      now: ahora,
    });
    expect(r).toEqual({ ok: true, count: 3 });
    expect(h.prisma.artworkRoyalty.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws1",
        authorUserId: 10,
        status: "ACCRUED",
        createdAt: { gte: new Date("2026-10-01T03:00:00Z"), lt: new Date("2026-11-01T03:00:00Z") },
      },
      data: { status: "PAID", paidAt: ahora, paidReference: "Transferencia 123", paidByUserId: 5 },
    });
  });

  it("rechaza referencia vacía o mes inválido sin escribir", async () => {
    expect(
      (await markAuthorMonthPaid({ workspaceId: "ws1", authorUserId: 10, month: "2026-10", reference: " ", userId: 5 })).ok,
    ).toBe(false);
    expect(
      (await markAuthorMonthPaid({ workspaceId: "ws1", authorUserId: 10, month: "2026-1", reference: "x", userId: 5 })).ok,
    ).toBe(false);
    expect(
      (await markAuthorMonthPaid({ workspaceId: "ws1", authorUserId: 0, month: "2026-10", reference: "x", userId: 5 })).ok,
    ).toBe(false);
    expect(h.prisma.artworkRoyalty.updateMany).not.toHaveBeenCalled();
  });

  it("si no quedaba nada a pagar lo dice", async () => {
    h.prisma.artworkRoyalty.updateMany.mockResolvedValue({ count: 0 });
    const r = await markAuthorMonthPaid({ workspaceId: "ws1", authorUserId: 10, month: "2026-10", reference: "x", userId: 5 });
    expect(r.ok).toBe(false);
  });
});

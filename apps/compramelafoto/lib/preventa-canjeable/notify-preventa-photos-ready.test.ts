import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  album: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  token: vi.fn(),
  mail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findUnique: (...a: unknown[]) => m.album(...a) },
    order: {
      findMany: (...a: unknown[]) => m.find(...a),
      update: (...a: unknown[]) => m.update(...a),
    },
    preCompraOrder: { findUnique: async () => null },
  },
  OrderOrigin: { PREVENTA_PACK: "PREVENTA_PACK" },
  OrderStatus: { PAID: "PAID" },
  Prisma: { AnyNull: "AnyNull" },
}));
vi.mock("@/lib/email-queue", () => ({ queueEmail: (...a: unknown[]) => m.mail(...a) }));
vi.mock("./pack-access-tokens", () => ({
  createPackAccessTokenForOrder: (...a: unknown[]) => m.token(...a),
}));

import { notifyPreventaPhotosReady, parseAvisoOrderIds, pendingWhere } from "./notify-preventa-photos-ready";

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.album.mockResolvedValue({ title: "Colegio San Patricio", user: { name: "Ceci" } });
  m.token.mockImplementation(async (id: number) => ({ token: `t${id}` }));
});

describe("pendingWhere", () => {
  it("sin lista: todos los pendientes del álbum", () => {
    expect(pendingWhere(1106)).toEqual({
      albumId: 1106,
      origin: "PREVENTA_PACK",
      status: "PAID",
      isTest: false,
      redemptionOrderId: null,
    });
  });
  it("con lista: sólo esos packs (un curso)", () => {
    expect(pendingWhere(1106, [4339, 4340])).toMatchObject({ albumId: 1106, isTest: false, id: { in: [4339, 4340] } });
  });
});

describe("parseAvisoOrderIds", () => {
  it("se queda con enteros positivos, sin repetir", () => {
    expect(parseAvisoOrderIds([4339, 4339, "4340", -1, 0, 1.5, 4341])).toEqual([4339, 4341]);
  });
  it("sin lista → null (todo el álbum)", () => {
    expect(parseAvisoOrderIds(undefined)).toBeNull();
    expect(parseAvisoOrderIds("4339")).toBeNull();
  });
});

describe("notifyPreventaPhotosReady", () => {
  it("con orderIds consulta sólo esos y no avisa a otros cursos", async () => {
    m.find.mockResolvedValue([
      { id: 4339, buyerEmail: "familia@example.com", buyerName: "Valenza Sabrina", preCompraPaymentRef: null, preventaPackSnapshotJson: { packName: "Preventa" }, redemptionPaymentRefsJson: null },
      { id: 4340, buyerEmail: "sin-email@canje-externo.invalid", buyerName: "Gabay", preCompraPaymentRef: null, preventaPackSnapshotJson: null, redemptionPaymentRefsJson: null },
    ]);
    const r = await notifyPreventaPhotosReady({ albumId: 1106, baseUrl: "https://x", orderIds: [4339, 4340] });
    expect(m.find.mock.calls[0]![0].where).toMatchObject({ id: { in: [4339, 4340] } });
    expect(r).toEqual({ enviados: 1, sinEmail: 1 });
    expect(m.mail).toHaveBeenCalledTimes(1);
    expect(m.mail.mock.calls[0]![0].to).toBe("familia@example.com");
    expect(m.token).toHaveBeenCalledTimes(1);
  });
  it("lista vacía → no consulta ni manda nada (no cae en 'todo el álbum')", async () => {
    expect(await notifyPreventaPhotosReady({ albumId: 1106, baseUrl: "https://x", orderIds: [] })).toEqual({
      enviados: 0,
      sinEmail: 0,
    });
    expect(m.find).not.toHaveBeenCalled();
    expect(m.mail).not.toHaveBeenCalled();
  });
});

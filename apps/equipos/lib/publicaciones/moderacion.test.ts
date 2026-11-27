import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  listingFindMany: vi.fn(),
  flagCreateMany: vi.fn(),
  reportFindFirst: vi.fn(),
  txListingUpdateMany: vi.fn(),
  txItemUpdateMany: vi.fn(),
  txEventCreate: vi.fn(),
  txFlagUpdateMany: vi.fn(),
  tx: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListing: { findFirst: m.listingFindFirst, findMany: m.listingFindMany },
    gearListingFlag: { createMany: m.flagCreateMany },
    stolenGearReport: { findFirst: m.reportFindFirst },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import {
  approveListing,
  flagListing,
  holdListingsWithActiveReports,
  rejectListing,
} from "./moderacion";

const seller = { email: "v@t.com", name: "Vero" };
const listing = (over: Record<string, unknown> = {}) => ({
  id: 5,
  sellerId: 2,
  gearItemId: 9,
  status: "IN_REVIEW",
  reviewNote: "Denuncia activa #3",
  make: "Canon",
  model: "R5",
  seller,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = "admin@dnx.test";
  m.tx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      gearListing: { updateMany: m.txListingUpdateMany },
      gearItem: { updateMany: m.txItemUpdateMany },
      gearItemEvent: { create: m.txEventCreate },
      gearListingFlag: { updateMany: m.txFlagUpdateMany },
    }),
  );
  m.txListingUpdateMany.mockResolvedValue({ count: 1 });
  m.flagCreateMany.mockResolvedValue({ count: 1 });
  m.email.mockResolvedValue({ success: true });
});

describe("flagListing", () => {
  it("crea el reporte y avisa al admin con el enlace del panel", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PUBLISHED" }));
    await flagListing(1, 5, "Parece una publicación falsa, la serie no coincide");
    expect(m.flagCreateMany.mock.calls[0][0]).toMatchObject({
      data: [{ listingId: 5, reporterId: 1 }],
      skipDuplicates: true,
    });
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.email.mock.calls[0][0]).toBe("admin@dnx.test");
    expect(m.email.mock.calls[0][1]).toBe("reporte_publicacion_admin");
    expect(m.email.mock.calls[0][2].url).toBe("https://e.test/admin/publicaciones");
  });

  it("el segundo reporte de la misma persona no duplica ni avisa", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PUBLISHED" }));
    m.flagCreateMany.mockResolvedValue({ count: 0 });
    await expect(flagListing(1, 5, "Otra vez lo mismo, ya lo había dicho")).resolves.toBeUndefined();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("el motivo debe tener de 10 a 500 caracteres", async () => {
    await expect(flagListing(1, 5, "corto")).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    await expect(flagListing(1, 5, "x".repeat(501))).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.flagCreateMany).not.toHaveBeenCalled();
  });

  it("no se puede reportar la propia publicación ni una que no existe", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PUBLISHED", sellerId: 1 }));
    await expect(flagListing(1, 5, "Motivo suficientemente largo")).rejects.toMatchObject({
      code: "DATO_INVALIDO",
    });
    m.listingFindFirst.mockResolvedValue(null);
    await expect(flagListing(1, 5, "Motivo suficientemente largo")).rejects.toMatchObject({
      code: "NO_ENCONTRADO",
    });
  });
});

describe("approveListing", () => {
  it("IN_REVIEW pasa a PUBLISHED con publishedAt y avisa al vendedor", async () => {
    m.listingFindFirst.mockResolvedValue(listing());
    await approveListing(1, 5);
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 5, status: "IN_REVIEW" });
    expect(arg.data.status).toBe("PUBLISHED");
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
    expect(m.email).toHaveBeenCalledWith("v@t.com", "publicacion_aprobada", expect.anything());
  });

  it("otro estado -> error y sin correo", async () => {
    m.listingFindFirst.mockResolvedValue(listing());
    m.txListingUpdateMany.mockResolvedValue({ count: 0 });
    await expect(approveListing(1, 5)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("rejectListing", () => {
  it("sobre una PUBLISHED falla", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PUBLISHED" }));
    m.txListingUpdateMany.mockResolvedValue({ count: 0 });
    await expect(rejectListing(1, 5, "Serie robada")).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.email).not.toHaveBeenCalled();
  });

  it("cierra, devuelve el equipo a IN_USE, agrega la nota y el correo no la incluye", async () => {
    m.listingFindFirst.mockResolvedValue(listing());
    await rejectListing(1, 5, "Serie robada");
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 5, status: "IN_REVIEW" });
    expect(arg.data.status).toBe("CLOSED");
    expect(arg.data.reviewNote).toBe("Denuncia activa #3\nSerie robada");
    expect(m.txItemUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 9, status: "FOR_SALE" },
      data: { status: "IN_USE" },
    });
    const [to, tpl, data] = m.email.mock.calls[0];
    expect(to).toBe("v@t.com");
    expect(tpl).toBe("publicacion_rechazada");
    expect(JSON.stringify(data)).not.toContain("Serie robada");
  });
});

describe("holdListingsWithActiveReports", () => {
  it("retiene lo que tiene denuncia activa y manda un correo por publicación", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: 5, sellerId: 2, gearItemId: 9, status: "PUBLISHED", gearItem: { serialNormalized: "AB123" } },
      { id: 6, sellerId: 3, gearItemId: 10, status: "PAUSED", gearItem: { serialNormalized: "ZZ9" } },
      { id: 7, sellerId: 4, gearItemId: 11, status: "PUBLISHED", gearItem: { serialNormalized: null } },
    ]);
    m.reportFindFirst.mockImplementation(async ({ where }: { where: { serialNormalized: string } }) =>
      where.serialNormalized === "AB123" ? { id: 33 } : null,
    );
    expect(await holdListingsWithActiveReports()).toEqual({ held: 1 });
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 5, status: { in: ["PUBLISHED", "PAUSED"] } });
    expect(arg.data).toEqual({ status: "IN_REVIEW", reviewNote: "Denuncia activa #33" });
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.email.mock.calls[0][1]).toBe("publicacion_en_revision_admin");
  });

  it("corre dos veces seguidas y avisa una sola vez", async () => {
    const fila = {
      id: 5,
      sellerId: 2,
      gearItemId: 9,
      status: "PUBLISHED",
      gearItem: { serialNormalized: "AB123" },
    };
    m.reportFindFirst.mockResolvedValue({ id: 33 });
    // Primera corrida: está publicada. Segunda: ya IN_REVIEW, la consulta no la devuelve.
    m.listingFindMany.mockResolvedValueOnce([fila]).mockResolvedValueOnce([]);
    await holdListingsWithActiveReports();
    await holdListingsWithActiveReports();
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.listingFindMany.mock.calls[0][0].where).toMatchObject({
      status: { in: ["PUBLISHED", "PAUSED"] },
    });
  });

  it("si otro cambio ganó (count 0) no avisa", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: 5, sellerId: 2, gearItemId: 9, status: "PUBLISHED", gearItem: { serialNormalized: "AB123" } },
    ]);
    m.reportFindFirst.mockResolvedValue({ id: 33 });
    m.txListingUpdateMany.mockResolvedValue({ count: 0 });
    expect(await holdListingsWithActiveReports()).toEqual({ held: 0 });
    expect(m.email).not.toHaveBeenCalled();
  });
});

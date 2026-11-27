import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  listingFindMany: vi.fn(),
  flagCreateMany: vi.fn(),
  flagUpdateMany: vi.fn(),
  eventFindFirst: vi.fn(),
  reportFindFirst: vi.fn(),
  reportFindMany: vi.fn(),
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
    gearListingFlag: { createMany: m.flagCreateMany, updateMany: m.flagUpdateMany },
    gearItemEvent: { findFirst: m.eventFindFirst },
    stolenGearReport: { findFirst: m.reportFindFirst, findMany: m.reportFindMany },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import {
  approveListing,
  flagListing,
  dismissFlag,
  holdListingsWithActiveReports,
  rejectListing,
  reviewFlaggedListing,
} from "./moderacion";

const seller = { email: "v@t.com", name: "Vero" };
const listing = (over: Record<string, unknown> = {}) => ({
  id: 5,
  sellerId: 2,
  gearItemId: 9,
  status: "IN_REVIEW",
  reviewNote: "Denuncia activa #3",
  publishedAt: null,
  make: "Canon",
  model: "R5",
  seller,
  gearItem: { serialNormalized: "AB123" },
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
  m.flagUpdateMany.mockResolvedValue({ count: 1 });
  m.eventFindFirst.mockResolvedValue(null);
  m.reportFindFirst.mockResolvedValue(null);
  m.reportFindMany.mockResolvedValue([]);
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

  it("con una denuncia activa de otra persona -> CON_DENUNCIA (409) sin tocar nada", async () => {
    m.listingFindFirst.mockResolvedValue(listing());
    m.reportFindFirst.mockResolvedValue({ id: 3 });
    await expect(approveListing(1, 5)).rejects.toMatchObject({
      code: "CON_DENUNCIA",
      message: "Hay una denuncia activa sobre esta serie: resolvela antes de aprobar.",
    });
    expect(m.reportFindFirst.mock.calls[0][0].where).toEqual({
      serialNormalized: "AB123",
      status: "ACTIVE",
      reporterId: { not: 2 },
    });
    expect(m.tx).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("sin denuncia activa aprueba y no deja eventos extra", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ reviewNote: "Reporte #2" }));
    await approveListing(1, 5);
    expect(m.txEventCreate.mock.calls.map((c) => c[0].data.type)).toEqual(["STATUS_CHANGED"]);
    expect(m.txEventCreate.mock.calls[0][0].data.detail).toMatchObject({ accion: "aprobado" });
  });

  it("retenida desde PAUSED vuelve a PAUSED, el equipo a IN_USE y no avisa «online»", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ publishedAt: new Date("2026-11-01") }));
    m.eventFindFirst.mockResolvedValue({
      detail: { listingId: 5, accion: "retenido", reportId: 3, previo: "PAUSED" },
    });
    await approveListing(1, 5);
    const where = m.eventFindFirst.mock.calls[0][0].where;
    expect(where.gearItemId).toBe(9);
    expect(where.AND[0]).toEqual({ detail: { path: ["listingId"], equals: 5 } });
    expect(m.txListingUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 5, status: "IN_REVIEW" },
      data: { status: "PAUSED" },
    });
    expect(m.txItemUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 9, status: "FOR_SALE" },
      data: { status: "IN_USE" },
    });
    expect(m.email).not.toHaveBeenCalled();
  });

  it("retenida desde PUBLISHED vuelve a PUBLISHED y conserva la fecha de publicación", async () => {
    const publishedAt = new Date("2026-11-01");
    m.listingFindFirst.mockResolvedValue(listing({ publishedAt }));
    m.eventFindFirst.mockResolvedValue({
      detail: { listingId: 5, accion: "revision_por_reporte", previo: "PUBLISHED" },
    });
    await approveListing(1, 5);
    expect(m.txListingUpdateMany.mock.calls[0][0].data).toEqual({ status: "PUBLISHED", publishedAt });
    expect(m.txItemUpdateMany).not.toHaveBeenCalled();
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
    expect(data.contacto).toBe(""); // sin CONTACTO_EMAIL no se invita a escribir
  });

  it("con CONTACTO_EMAIL el rechazo lleva el correo y el mailto", async () => {
    process.env.CONTACTO_EMAIL = "hola@mercadofotoraw.com";
    m.listingFindFirst.mockResolvedValue(listing());
    await rejectListing(1, 5, "Serie robada");
    const data = m.email.mock.calls[0][2];
    expect(data.contacto).toBe("hola@mercadofotoraw.com");
    expect(data.contactoUrl).toMatch(/^mailto:hola@mercadofotoraw\.com\?subject=/);
    delete process.env.CONTACTO_EMAIL;
  });
});

describe("holdListingsWithActiveReports", () => {
  it("retiene lo que tiene denuncia activa y manda un correo por publicación", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: 5, sellerId: 2, gearItemId: 9, status: "PUBLISHED", gearItem: { serialNormalized: "AB123" } },
      { id: 6, sellerId: 3, gearItemId: 10, status: "PAUSED", gearItem: { serialNormalized: "ZZ9" } },
      { id: 7, sellerId: 4, gearItemId: 11, status: "PUBLISHED", gearItem: { serialNormalized: null } },
    ]);
    m.reportFindMany.mockImplementation(async ({ where }: { where: { serialNormalized: string } }) =>
      where.serialNormalized === "AB123" ? [{ id: 33 }] : [],
    );
    expect(await holdListingsWithActiveReports()).toEqual({ held: 1 });
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 5, status: "PUBLISHED" });
    expect(arg.data).toEqual({ status: "IN_REVIEW", reviewNote: "Denuncia activa #33" });
    expect(m.txEventCreate.mock.calls[0][0].data.detail).toEqual({
      listingId: 5,
      accion: "retenido",
      reportId: 33,
      previo: "PUBLISHED",
    });
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
    m.reportFindMany.mockResolvedValue([{ id: 33 }]);
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
    m.reportFindMany.mockResolvedValue([{ id: 33 }]);
    m.txListingUpdateMany.mockResolvedValue({ count: 0 });
    expect(await holdListingsWithActiveReports()).toEqual({ held: 0 });
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("cruce con varias denuncias", () => {
  it("una pausada se retiene guardando previo PAUSED y la nota cita todas", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: 6, sellerId: 3, gearItemId: 10, status: "PAUSED", gearItem: { serialNormalized: "ZZ9" } },
    ]);
    m.reportFindMany.mockResolvedValue([{ id: 4 }, { id: 8 }]);
    expect(await holdListingsWithActiveReports()).toEqual({ held: 1 });
    expect(m.reportFindMany.mock.calls[0][0]).toMatchObject({
      where: { serialNormalized: "ZZ9", status: "ACTIVE", reporterId: { not: 3 } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 6, status: "PAUSED" });
    expect(arg.data.reviewNote).toBe("Denuncia activa #4\nDenuncia activa #8");
    expect(m.txEventCreate.mock.calls[0][0].data.detail).toMatchObject({ reportId: 4, previo: "PAUSED" });
  });

  it("sin denuncias activas no retiene", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: 6, sellerId: 3, gearItemId: 10, status: "PAUSED", gearItem: { serialNormalized: "ZZ9" } },
    ]);
    expect(await holdListingsWithActiveReports()).toEqual({ held: 0 });
    expect(m.tx).not.toHaveBeenCalled();
  });
});

describe("reviewFlaggedListing", () => {
  it("pasa PUBLISHED/PAUSED a IN_REVIEW con la nota del reporte y guarda el estado previo", async () => {
    m.listingFindFirst.mockResolvedValue({ id: 5, gearItemId: 9, status: "PAUSED", reviewNote: null });
    await reviewFlaggedListing(1, 5, 12);
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 5, status: "PAUSED" });
    expect(arg.data).toEqual({ status: "IN_REVIEW", reviewNote: "Reporte #12" });
    expect(m.txEventCreate.mock.calls[0][0].data.detail).toMatchObject({
      accion: "revision_por_reporte",
      previo: "PAUSED",
    });
  });

  it("una que no está publicada ni pausada falla sin transacción", async () => {
    m.listingFindFirst.mockResolvedValue({ id: 5, gearItemId: 9, status: "CLOSED", reviewNote: null });
    await expect(reviewFlaggedListing(1, 5, 12)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("agrega a la nota existente", async () => {
    m.listingFindFirst.mockResolvedValue({ id: 5, gearItemId: 9, status: "PUBLISHED", reviewNote: "Algo" });
    await reviewFlaggedListing(1, 5, 12);
    expect(m.txListingUpdateMany.mock.calls[0][0].data.reviewNote).toBe("Algo\nReporte #12");
  });

  it("si ya no está publicada (count 0) falla", async () => {
    m.listingFindFirst.mockResolvedValue({ id: 5, gearItemId: 9, status: "PUBLISHED", reviewNote: null });
    m.txListingUpdateMany.mockResolvedValue({ count: 0 });
    await expect(reviewFlaggedListing(1, 5, 12)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.txEventCreate).not.toHaveBeenCalled();
  });

  it("publicación inexistente -> NO_ENCONTRADO", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(reviewFlaggedListing(1, 5, 12)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
  });
});

describe("dismissFlag", () => {
  it("resuelve sólo ese reporte", async () => {
    await dismissFlag(5, 12);
    expect(m.flagUpdateMany.mock.calls[0][0].where).toEqual({ id: 12, listingId: 5, resolvedAt: null });
    expect(m.flagUpdateMany.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date);
  });

  it("reporte ya resuelto -> error", async () => {
    m.flagUpdateMany.mockResolvedValue({ count: 0 });
    await expect(dismissFlag(5, 12)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });
});

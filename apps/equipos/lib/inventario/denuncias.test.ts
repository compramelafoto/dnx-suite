import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  itemFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  reportFindMany: vi.fn(),
  eventFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  txItemUpdate: vi.fn(),
  txEventCreate: vi.fn(),
  txReportCreate: vi.fn(),
  txReportUpdateMany: vi.fn(),
  txListingUpdateMany: vi.fn(),
  txLock: vi.fn(),
  tx: vi.fn(),
  upload: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearItem: { findFirst: m.itemFindFirst, findMany: m.itemFindMany },
    stolenGearReport: { findMany: m.reportFindMany },
    gearItemEvent: { findFirst: m.eventFindFirst, create: m.eventCreate },
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Ana", email: "ana@test.com" }) },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/archivos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archivos")>("@/lib/archivos");
  return { ...actual, uploadPrivateFile: m.upload };
});
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));

import { findInventoryMatches, markRecovered, notifyNewInventoryMatches, reportIncident } from "./denuncias";

const file = (type = "application/pdf") => new File([new Uint8Array(10)], "x", { type });
const when = new Date("2026-11-20T15:00:00.000Z");

const body = (over: Record<string, unknown> = {}) => ({
  id: 7,
  ownerId: 1,
  kind: "BODY",
  make: "Canon",
  model: "R5",
  serialRaw: "AB-123",
  serialNormalized: "AB123",
  status: "IN_USE",
  purchaseProofKey: null,
  purchaseProofMime: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      $queryRaw: m.txLock,
      gearItem: { update: m.txItemUpdate },
      gearItemEvent: { create: m.txEventCreate },
      stolenGearReport: { create: m.txReportCreate, updateMany: m.txReportUpdateMany },
      gearListing: { updateMany: m.txListingUpdateMany },
    }),
  );
  m.txReportCreate.mockResolvedValue({ id: 99 });
  m.txReportUpdateMany.mockResolvedValue({ count: 1 });
  m.txItemUpdate.mockResolvedValue({});
  m.txEventCreate.mockResolvedValue({});
  m.upload.mockResolvedValue({ key: "equipos/new.pdf", mime: "application/pdf" });
  m.email.mockResolvedValue({ success: true });
});

describe("reportIncident", () => {
  it("sobre un equipo publicado cierra la publicación en la misma transacción", async () => {
    m.itemFindFirst.mockResolvedValue(
      body({ status: "FOR_SALE", purchaseProofKey: "equipos/f.pdf", purchaseProofMime: "application/pdf" }),
    );
    await reportIncident(1, 7, { incident: "THEFT", occurredAt: when });
    expect(m.txLock).toHaveBeenCalledTimes(1);
    expect(m.txListingUpdateMany).toHaveBeenCalledTimes(1);
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where.gearItemId).toBe(7);
    expect(arg.data.status).toBe("CLOSED");
  });

  it("robo sin comprobante falla con FALTA_COMPROBANTE", async () => {
    m.itemFindFirst.mockResolvedValue(body());
    await expect(reportIncident(1, 7, { incident: "THEFT", occurredAt: when })).rejects.toMatchObject({
      code: "FALTA_COMPROBANTE",
    });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("pérdida sin comprobante crea la denuncia con invoiceKey null", async () => {
    m.itemFindFirst.mockResolvedValue(body());
    const r = await reportIncident(1, 7, {
      incident: "LOST",
      occurredAt: when,
      place: "Rafaela",
    });
    expect(r).toEqual({ reportId: 99 });
    expect(m.txReportCreate.mock.calls[0][0].data).toMatchObject({
      reporterId: 1,
      kind: "BODY",
      serialNormalized: "AB123",
      stolenAt: when,
      stolenPlace: "Rafaela",
      incident: "LOST",
      gearItemId: 7,
      invoiceKey: null,
      status: "PENDING_REVIEW",
    });
    expect(m.txItemUpdate.mock.calls[0][0].data).toMatchObject({ status: "LOST" });
    expect(m.txEventCreate.mock.calls[0][0].data).toMatchObject({ type: "REPORTED" });
    expect(m.email).toHaveBeenCalledWith("ana@test.com", "denuncia_recibida", expect.any(Object));
  });

  it("reutiliza el comprobante ya cargado en el equipo", async () => {
    m.itemFindFirst.mockResolvedValue(
      body({ purchaseProofKey: "equipos/old.jpg", purchaseProofMime: "image/jpeg" }),
    );
    await reportIncident(1, 7, { incident: "THEFT", occurredAt: when, invoice: file() });
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.txReportCreate.mock.calls[0][0].data).toMatchObject({
      invoiceKey: "equipos/old.jpg",
      invoiceMime: "image/jpeg",
    });
  });

  it("sube la factura adjunta y también la guarda como comprobante del equipo", async () => {
    m.itemFindFirst.mockResolvedValue(body());
    await reportIncident(1, 7, { incident: "THEFT", occurredAt: when, invoice: file() });
    expect(m.txReportCreate.mock.calls[0][0].data).toMatchObject({ invoiceKey: "equipos/new.pdf" });
    expect(m.txItemUpdate.mock.calls[0][0].data).toMatchObject({
      status: "STOLEN",
      purchaseProofKey: "equipos/new.pdf",
    });
  });

  it("un trípode no genera denuncia y queda STOLEN", async () => {
    m.itemFindFirst.mockResolvedValue(body({ kind: "TRIPOD", serialRaw: null, serialNormalized: null }));
    const r = await reportIncident(1, 7, { incident: "THEFT", occurredAt: when });
    expect(r).toEqual({ reportId: null });
    expect(m.txReportCreate).not.toHaveBeenCalled();
    expect(m.txItemUpdate.mock.calls[0][0].data).toMatchObject({ status: "STOLEN" });
    expect(m.txEventCreate).toHaveBeenCalled();
  });

  it("un equipo ya denunciado falla con YA_DENUNCIADO", async () => {
    m.itemFindFirst.mockResolvedValue(body({ status: "STOLEN" }));
    await expect(reportIncident(1, 7, { incident: "LOST", occurredAt: when })).rejects.toMatchObject({
      code: "YA_DENUNCIADO",
    });
  });

  it("un equipo vendido falla con NO_DENUNCIABLE", async () => {
    m.itemFindFirst.mockResolvedValue(body({ status: "SOLD" }));
    await expect(reportIncident(1, 7, { incident: "LOST", occurredAt: when })).rejects.toMatchObject({
      code: "NO_DENUNCIABLE",
      message: "Este equipo figura como vendido.",
    });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("un equipo recuperado se puede volver a denunciar", async () => {
    m.itemFindFirst.mockResolvedValue(body({ status: "RECOVERED" }));
    await expect(reportIncident(1, 7, { incident: "LOST", occurredAt: when })).resolves.toEqual({
      reportId: 99,
    });
  });

  it("un correo que falla no frena la denuncia", async () => {
    m.itemFindFirst.mockResolvedValue(body());
    m.email.mockRejectedValue(new Error("boom"));
    await expect(reportIncident(1, 7, { incident: "LOST", occurredAt: when })).resolves.toEqual({
      reportId: 99,
    });
  });
});

describe("markRecovered", () => {
  it("marca recuperado el equipo y la denuncia vinculada propia", async () => {
    m.itemFindFirst.mockResolvedValue(body({ status: "STOLEN" }));
    await markRecovered(1, 7);
    expect(m.txItemUpdate.mock.calls[0][0].data).toMatchObject({ status: "RECOVERED" });
    const upd = m.txReportUpdateMany.mock.calls[0][0];
    expect(upd.where).toMatchObject({
      gearItemId: 7,
      reporterId: 1,
      status: { in: ["ACTIVE", "PENDING_REVIEW"] },
    });
    expect(upd.data.status).toBe("RECOVERED");
    expect(upd.data.recoveredAt).toBeInstanceOf(Date);
    expect(m.txEventCreate.mock.calls[0][0].data).toMatchObject({ type: "RECOVERED" });
  });

  it("si el equipo no está robado/perdido falla", async () => {
    m.itemFindFirst.mockResolvedValue(body({ status: "IN_USE" }));
    await expect(markRecovered(1, 7)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });

  it("un equipo ajeno es NO_ENCONTRADO", async () => {
    m.itemFindFirst.mockResolvedValue(null);
    await expect(markRecovered(2, 7)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
  });
});

describe("findInventoryMatches", () => {
  it("ignora el propio inventario del denunciante", async () => {
    m.reportFindMany.mockResolvedValue([{ id: 1, reporterId: 10, serialNormalized: "AB123" }]);
    m.itemFindMany.mockResolvedValue([]);
    const r = await findInventoryMatches();
    expect(m.itemFindMany.mock.calls[0][0].where).toMatchObject({
      serialNormalized: "AB123",
      ownerId: { not: 10 },
    });
    expect(r).toEqual([]);
  });

  it("devuelve denuncia + equipo de otro dueño", async () => {
    m.reportFindMany.mockResolvedValue([{ id: 1, reporterId: 10, serialNormalized: "AB123" }]);
    m.itemFindMany.mockResolvedValue([{ id: 55 }]);
    expect(await findInventoryMatches()).toEqual([{ reportId: 1, gearItemId: 55 }]);
  });
});

describe("notifyNewInventoryMatches", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = "admin@dnx.test";
    process.env.CLF_URL = "https://clf.test/";
    m.reportFindMany.mockResolvedValue([{ id: 1, reporterId: 10, serialNormalized: "AB123" }]);
    m.itemFindMany.mockResolvedValue([{ id: 55 }]);
  });

  it("avisa lo nuevo, sin datos personales en el asunto, y lo recuerda", async () => {
    m.eventFindFirst.mockResolvedValue(null);
    expect(await notifyNewInventoryMatches()).toEqual({ found: 1, notified: 1 });
    expect(m.email).toHaveBeenCalledWith(
      "admin@dnx.test",
      "coincidencia_inventario_admin",
      expect.objectContaining({ url: "https://clf.test/admin/equipos-robados" }),
    );
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({
      gearItemId: 55,
      type: "UPDATED",
      detail: { matchReportId: 1 },
    });
  });

  it("no repite una coincidencia ya avisada", async () => {
    m.eventFindFirst.mockResolvedValue({ id: 3 });
    expect(await notifyNewInventoryMatches()).toEqual({ found: 1, notified: 0 });
    expect(m.email).not.toHaveBeenCalled();
  });
});

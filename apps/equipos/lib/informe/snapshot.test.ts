import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  itemFindMany: vi.fn(),
  identFindUnique: vi.fn(),
  reportCreate: vi.fn(),
  reportFindUnique: vi.fn(),
  requireLevel: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearItem: { findMany: m.itemFindMany },
    identityVerification: { findUnique: m.identFindUnique },
    insuranceReport: { create: m.reportCreate, findUnique: m.reportFindUnique },
  },
}));
vi.mock("@/lib/guards", () => ({ requireLevel: m.requireLevel }));

import {
  buildSnapshot,
  createInsuranceReport,
  getPublicReport,
  hashSnapshot,
  type ReportSnapshot,
} from "./snapshot";

const issued = new Date("2026-11-25T15:00:00.000Z");

const gear = (over: Record<string, unknown> = {}) => ({
  id: 1,
  ownerId: 5,
  kind: "BODY",
  make: "Canon",
  model: "R5",
  serialRaw: "AB-123",
  status: "IN_USE",
  purchaseDate: new Date("2025-03-01T12:00:00.000Z"),
  purchaseProofKey: "proofs/x.pdf",
  declaredValueArs: 4000000,
  declaredValueUsd: 3500,
  sighting: { photosCount: 40, firstSeenAt: new Date("2024-05-02T10:00:00.000Z") },
  ...over,
});

const snap = (): ReportSnapshot =>
  buildSnapshot({
    issuedAt: issued,
    holder: { legalName: "Ana Pérez", documentLast3: "456" },
    items: [gear(), gear({ id: 2, kind: "LENS", sighting: null, purchaseProofKey: null })],
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireLevel.mockResolvedValue({ id: 5, level: "identidad" });
  m.identFindUnique.mockResolvedValue({
    status: "APPROVED",
    legalName: "Ana Pérez",
    documentLast3: "456",
    reverifyRequiredAt: null,
  });
  m.reportCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1,
    ...data,
  }));
});

describe("buildSnapshot / hashSnapshot", () => {
  it("arma los ítems con sello, comprobante y totales", () => {
    const s = snap();
    expect(s.totalArs).toBe(8000000);
    expect(s.totalUsd).toBe(7000);
    expect(s.items[0]).toMatchObject({
      kind: "BODY",
      serialRaw: "AB-123",
      hasPurchaseProof: true,
      purchaseDate: "2025-03-01",
      seal: { photosCount: 40, since: "2024-05-02" },
      valueArs: 4000000,
    });
    expect(s.items[1].seal).toBeNull();
    expect(s.items[1].hasPurchaseProof).toBe(false);
    expect(s.issuedAt).toBe(issued.toISOString());
  });

  it("el hash es igual con las claves en otro orden y cambia si cambia el contenido", () => {
    const s = snap();
    const reordenado = JSON.parse(
      JSON.stringify({
        totalUsd: s.totalUsd,
        items: s.items.map((i) => Object.fromEntries(Object.entries(i).reverse())),
        holder: { documentLast3: s.holder.documentLast3, legalName: s.holder.legalName },
        totalArs: s.totalArs,
        issuedAt: s.issuedAt,
      }),
    ) as ReportSnapshot;
    expect(hashSnapshot(reordenado)).toBe(hashSnapshot(s));
    expect(hashSnapshot(s)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSnapshot({ ...s, totalArs: s.totalArs + 1 })).not.toBe(hashSnapshot(s));
  });
});

describe("createInsuranceReport", () => {
  it("crea el informe con código base64url de 16 bytes y el hash del snapshot", async () => {
    m.itemFindMany.mockResolvedValue([gear()]);
    const { code } = await createInsuranceReport(5, [1]);
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const data = m.reportCreate.mock.calls[0][0].data;
    expect(data.ownerId).toBe(5);
    expect(data.code).toBe(code);
    expect(data.contentHash).toBe(hashSnapshot(data.snapshot));
    expect(data.totalArs).toBe(4000000);
    expect(data.snapshot.holder).toEqual({ legalName: "Ana Pérez", documentLast3: "456" });
  });

  it("exige nivel identidad", async () => {
    await createInsuranceReport(5, [1]).catch(() => {});
    expect(m.requireLevel).toHaveBeenCalledWith("identidad", "/mi-equipo/informe");
  });

  it("un equipo ajeno o inexistente es NO_ENCONTRADO y no crea nada", async () => {
    m.itemFindMany.mockResolvedValue([gear()]); // pidió 1 y 2; sólo 1 es suyo
    await expect(createInsuranceReport(5, [1, 2])).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.reportCreate).not.toHaveBeenCalled();
    expect(m.itemFindMany.mock.calls[0][0].where).toMatchObject({ ownerId: 5 });
  });

  it("un equipo sin ambos valores es FALTA_VALOR", async () => {
    m.itemFindMany.mockResolvedValue([gear({ declaredValueUsd: null })]);
    await expect(createInsuranceReport(5, [1])).rejects.toMatchObject({ code: "FALTA_VALOR" });
    expect(m.reportCreate).not.toHaveBeenCalled();
  });

  it.each(["STOLEN", "LOST", "SOLD"])("un equipo %s es NO_ASEGURABLE", async (status) => {
    m.itemFindMany.mockResolvedValue([gear({ status })]);
    await expect(createInsuranceReport(5, [1])).rejects.toMatchObject({ code: "NO_ASEGURABLE" });
    expect(m.reportCreate).not.toHaveBeenCalled();
  });

  it("sin equipos es DATO_INVALIDO", async () => {
    await expect(createInsuranceReport(5, [])).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });

  it("sin identidad aprobada es DATO_INVALIDO", async () => {
    m.itemFindMany.mockResolvedValue([gear()]);
    m.identFindUnique.mockResolvedValue({
      status: "REJECTED",
      legalName: "A",
      documentLast3: "1",
      reverifyRequiredAt: null,
    });
    await expect(createInsuranceReport(5, [1])).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });
});

describe("getPublicReport", () => {
  const stored = () => {
    const snapshot = snap();
    return {
      id: 1,
      ownerId: 5,
      code: "abc",
      snapshot,
      contentHash: hashSnapshot(snapshot),
      createdAt: issued,
    };
  };

  it("muestra sólo el snapshot guardado, sin consultar equipos en vivo", async () => {
    m.reportFindUnique.mockResolvedValue(stored());
    m.identFindUnique.mockResolvedValue({ status: "APPROVED", reverifyRequiredAt: null });
    const r = await getPublicReport("abc");
    expect(r?.snapshot.items[0].make).toBe("Canon");
    expect(r?.holderVerified).toBe(true);
    expect(r?.hashOk).toBe(true);
    expect(m.itemFindMany).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/ownerId|email/);
  });

  it("con la verificación en REJECTED, el titular ya no está verificado", async () => {
    m.reportFindUnique.mockResolvedValue(stored());
    m.identFindUnique.mockResolvedValue({ status: "REJECTED", reverifyRequiredAt: null });
    expect((await getPublicReport("abc"))?.holderVerified).toBe(false);
  });

  it("con reverifyRequiredAt, el titular ya no está verificado", async () => {
    m.reportFindUnique.mockResolvedValue(stored());
    m.identFindUnique.mockResolvedValue({ status: "APPROVED", reverifyRequiredAt: new Date() });
    expect((await getPublicReport("abc"))?.holderVerified).toBe(false);
  });

  it("código desconocido devuelve null", async () => {
    m.reportFindUnique.mockResolvedValue(null);
    expect(await getPublicReport("nope")).toBeNull();
  });
});

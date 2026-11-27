import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  itemFindFirst: vi.fn(),
  reportCount: vi.fn(),
  reportFindFirst: vi.fn(),
  listingFindFirst: vi.fn(),
  listingFindMany: vi.fn(),
  sightingFindMany: vi.fn(),
  txListingCreate: vi.fn(),
  txListingUpdate: vi.fn(),
  txListingUpdateMany: vi.fn(),
  txItemUpdate: vi.fn(),
  txEventCreate: vi.fn(),
  tx: vi.fn(),
  upload: vi.fn(),
  email: vi.fn(),
  proof: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearItem: { findFirst: m.itemFindFirst },
    stolenGearReport: { count: m.reportCount, findFirst: m.reportFindFirst },
    gearListing: { findFirst: m.listingFindFirst, findMany: m.listingFindMany },
    gearSerialSighting: { findMany: m.sightingFindMany },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/archivos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archivos")>("@/lib/archivos");
  return { ...actual, uploadPrivateFile: m.upload };
});
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("./sellos", async () => {
  const actual = await vi.importActual<typeof import("./sellos")>("./sellos");
  return { ...actual, proofPhotoMatches: m.proof };
});

import {
  closeListing,
  closeListingsForItem,
  createListing,
  findActiveReportForSerial,
  listSellerListings,
  pauseListing,
  resumeListing,
  updateListing,
} from "./publicar";

const img = (type = "image/jpeg") => new File([new Uint8Array(10)], "x", { type });

const item = (over: Record<string, unknown> = {}) => ({
  id: 7,
  ownerId: 1,
  kind: "BODY",
  make: "Canon",
  model: "R5",
  serialRaw: "AB-123",
  serialNormalized: "AB123",
  status: "IN_USE",
  photoKeys: ["equipos/a.jpg"],
  ...over,
});

const input = {
  priceArs: 1500000,
  condition: "GOOD" as const,
  province: "Santa Fe",
  city: "Rafaela",
  socialConsent: true,
  declaredFirstOwner: true,
  includesCharger: true,
  includesManual: false,
  includesBox: true,
  batteriesCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = "admin@dnx.test";
  process.env.CLF_URL = "https://clf.test/";
  m.tx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      gearListing: {
        create: m.txListingCreate,
        update: m.txListingUpdate,
        updateMany: m.txListingUpdateMany,
      },
      gearItem: { update: m.txItemUpdate },
      gearItemEvent: { create: m.txEventCreate },
    }),
  );
  m.txListingCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 70,
    ...data,
  }));
  m.txListingUpdate.mockResolvedValue({});
  m.txListingUpdateMany.mockResolvedValue({ count: 1 });
  m.txItemUpdate.mockResolvedValue({});
  m.txEventCreate.mockResolvedValue({});
  m.itemFindFirst.mockResolvedValue(item());
  m.reportCount.mockResolvedValue(0);
  m.reportFindFirst.mockResolvedValue(null);
  m.listingFindFirst.mockResolvedValue(null);
  m.sightingFindMany.mockResolvedValue([]);
  m.upload.mockResolvedValue({ key: "equipos/serie.jpg", mime: "image/jpeg" });
  m.email.mockResolvedValue({ success: true });
  m.proof.mockResolvedValue(false);
});

describe("createListing", () => {
  it("equipo de otro dueño → NO_ENCONTRADO", async () => {
    m.itemFindFirst.mockResolvedValue(null);
    await expect(createListing(1, 7, input, { serialPhoto: img() })).rejects.toMatchObject({
      code: "NO_ENCONTRADO",
    });
    expect(m.itemFindFirst.mock.calls[0][0].where).toEqual({ id: 7, ownerId: 1 });
  });

  it("con denuncia propia pendiente no se puede publicar", async () => {
    m.reportCount.mockResolvedValue(1);
    await expect(createListing(1, 7, input, { serialPhoto: img() })).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: "Este equipo no se puede publicar en su estado actual.",
    });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("publica: copia datos del equipo, lo pasa a FOR_SALE y deja el evento", async () => {
    const r = await createListing(1, 7, input, { serialPhoto: img() });
    expect(r).toEqual({ listingId: 70, status: "PUBLISHED" });
    const data = m.txListingCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      sellerId: 1,
      gearItemId: 7,
      kind: "BODY",
      make: "Canon",
      model: "R5",
      status: "PUBLISHED",
      serialPhotoKey: "equipos/serie.jpg",
      declaredFirstOwner: true,
      includesCharger: true,
      batteriesCount: 2,
      usageSeal: "NONE",
    });
    expect(data.socialConsentAt).toBeInstanceOf(Date);
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(m.txItemUpdate.mock.calls[0][0].data).toEqual({ status: "FOR_SALE" });
    expect(m.txEventCreate.mock.calls[0][0].data).toMatchObject({
      gearItemId: 7,
      type: "STATUS_CHANGED",
      detail: { listingId: 70, accion: "publicado" },
    });
    expect(m.email).not.toHaveBeenCalled();
  });

  it("denuncia ACTIVE de otro usuario → IN_REVIEW, un solo correo al admin, sin reviewNote en lo devuelto", async () => {
    m.reportFindFirst.mockResolvedValue({ id: 33 });
    const r = await createListing(1, 7, input, { serialPhoto: img() });
    expect(r).toEqual({ listingId: 70, status: "IN_REVIEW" });
    expect(JSON.stringify(r)).not.toContain("33");
    const data = m.txListingCreate.mock.calls[0][0].data;
    expect(data.status).toBe("IN_REVIEW");
    expect(data.reviewNote).toBe("Denuncia activa #33");
    expect(data.publishedAt).toBeUndefined();
    expect(m.reportFindFirst.mock.calls[0][0].where).toMatchObject({
      serialNormalized: "AB123",
      status: "ACTIVE",
      reporterId: { not: 1 },
    });
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.email.mock.calls[0][0]).toBe("admin@dnx.test");
    expect(m.email.mock.calls[0][1]).toBe("publicacion_en_revision_admin");
  });

  it("un fallo del correo no rompe la operación", async () => {
    m.reportFindFirst.mockResolvedValue({ id: 33 });
    m.email.mockRejectedValue(new Error("boom"));
    await expect(createListing(1, 7, input, { serialPhoto: img() })).resolves.toMatchObject({
      status: "IN_REVIEW",
    });
  });

  it("avistaje del vendedor → USAGE_VERIFIED", async () => {
    const since = new Date("2025-01-10T00:00:00Z");
    m.sightingFindMany.mockResolvedValue([
      { photographerId: 1, firstSeenAt: since, photosCount: 40 },
    ]);
    await createListing(1, 7, input, { serialPhoto: img() });
    expect(m.txListingCreate.mock.calls[0][0].data).toMatchObject({
      usageSeal: "USAGE_VERIFIED",
      usageSince: since,
      usagePhotosCount: 40,
    });
  });

  it("avistaje sólo de otro → NONE y aviso serie_de_otro_usuario_admin", async () => {
    m.sightingFindMany.mockResolvedValue([
      { photographerId: 2, firstSeenAt: new Date(), photosCount: 5 },
    ]);
    const r = await createListing(1, 7, input, { serialPhoto: img() });
    expect(r.status).toBe("PUBLISHED");
    expect(m.txListingCreate.mock.calls[0][0].data.usageSeal).toBe("NONE");
    expect(m.email.mock.calls.map((c) => c[1])).toEqual(["serie_de_otro_usuario_admin"]);
  });

  it("foto de prueba con la serie correcta → PROOF_PHOTO y no se sube", async () => {
    m.proof.mockResolvedValue(true);
    await createListing(1, 7, input, { serialPhoto: img(), proofPhoto: img() });
    expect(m.txListingCreate.mock.calls[0][0].data.usageSeal).toBe("PROOF_PHOTO");
    expect(m.upload).toHaveBeenCalledTimes(1);
  });

  it("foto de prueba con otra serie → NONE", async () => {
    await createListing(1, 7, input, { serialPhoto: img(), proofPhoto: img() });
    expect(m.txListingCreate.mock.calls[0][0].data.usageSeal).toBe("NONE");
  });

  it("falta la foto de la serie en una cámara → error", async () => {
    await expect(createListing(1, 7, input, {})).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });

  it("foto de serie con formato inválido → ARCHIVO_INVALIDO", async () => {
    await expect(
      createListing(1, 7, input, { serialPhoto: img("application/pdf") }),
    ).rejects.toMatchObject({ code: "ARCHIVO_INVALIDO" });
  });

  it("datos inválidos → DATO_INVALIDO sin transacción", async () => {
    await expect(
      createListing(1, 7, { ...input, priceArs: 0 }, { serialPhoto: img() }),
    ).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.tx).not.toHaveBeenCalled();
  });
});

describe("findActiveReportForSerial", () => {
  it("busca denuncias ACTIVE de otro usuario", async () => {
    m.reportFindFirst.mockResolvedValue({ id: 5 });
    expect(await findActiveReportForSerial("AB123", 1)).toEqual({ id: 5 });
    expect(m.reportFindFirst.mock.calls[0][0].where).toEqual({
      serialNormalized: "AB123",
      status: "ACTIVE",
      reporterId: { not: 1 },
    });
  });
});

const listing = (over: Record<string, unknown> = {}) => ({
  id: 70,
  sellerId: 1,
  gearItemId: 7,
  status: "PUBLISHED",
  kind: "BODY",
  ...over,
});

describe("pausar, reanudar, cerrar, editar", () => {
  it("pauseListing: PUBLISHED → PAUSED y el equipo vuelve a IN_USE", async () => {
    m.listingFindFirst.mockResolvedValue(listing());
    await pauseListing(1, 70);
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({ id: 70, sellerId: 1 });
    expect(m.txListingUpdate.mock.calls[0][0].data).toMatchObject({ status: "PAUSED" });
    expect(m.txItemUpdate.mock.calls[0][0].data).toEqual({ status: "IN_USE" });
    expect(m.txEventCreate.mock.calls[0][0].data.detail).toEqual({ listingId: 70, accion: "pausado" });
  });

  it("pauseListing sobre una publicación cerrada → error", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "CLOSED" }));
    await expect(pauseListing(1, 70)).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: "Esta publicación ya no se puede modificar.",
    });
  });

  it("publicación ajena → NO_ENCONTRADO", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await expect(closeListing(1, 70)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
  });

  it("resumeListing sin denuncia → PUBLISHED y equipo FOR_SALE", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PAUSED" }));
    m.itemFindFirst.mockResolvedValue(item());
    const r = await resumeListing(1, 70);
    expect(r.status).toBe("PUBLISHED");
    expect(m.txListingUpdate.mock.calls[0][0].data.status).toBe("PUBLISHED");
    expect(m.txItemUpdate.mock.calls[0][0].data).toEqual({ status: "FOR_SALE" });
  });

  it("resumeListing con denuncia aprobada mientras estaba pausada → IN_REVIEW", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PAUSED" }));
    m.reportFindFirst.mockResolvedValue({ id: 44 });
    const r = await resumeListing(1, 70);
    expect(r.status).toBe("IN_REVIEW");
    expect(m.txListingUpdate.mock.calls[0][0].data).toMatchObject({
      status: "IN_REVIEW",
      reviewNote: "Denuncia activa #44",
    });
    expect(m.email.mock.calls[0][1]).toBe("publicacion_en_revision_admin");
  });

  it("resumeListing de una publicación no pausada → error", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "PUBLISHED" }));
    await expect(resumeListing(1, 70)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
  });

  it("closeListing: IN_REVIEW → CLOSED con closedAt y equipo a IN_USE", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "IN_REVIEW" }));
    await closeListing(1, 70);
    const data = m.txListingUpdate.mock.calls[0][0].data;
    expect(data.status).toBe("CLOSED");
    expect(data.closedAt).toBeInstanceOf(Date);
    expect(m.txItemUpdate.mock.calls[0][0].data).toEqual({ status: "IN_USE" });
  });

  it("updateListing sólo en PUBLISHED/PAUSED y no toca el sello", async () => {
    m.listingFindFirst.mockResolvedValue(listing({ status: "IN_REVIEW" }));
    await expect(updateListing(1, 70, input)).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    m.listingFindFirst.mockResolvedValue(listing({ status: "PAUSED" }));
    await updateListing(1, 70, { ...input, priceArs: 1400000 });
    const data = m.txListingUpdate.mock.calls[0][0].data;
    expect(data.priceArs).toBe(1400000);
    expect(data).not.toHaveProperty("usageSeal");
    expect(data).not.toHaveProperty("status");
    expect(m.txEventCreate.mock.calls[0][0].data.detail).toEqual({ listingId: 70, accion: "editado" });
  });
});

describe("closeListingsForItem y listSellerListings", () => {
  it("cierra las publicaciones abiertas del equipo", async () => {
    const tx = { gearListing: { updateMany: m.txListingUpdateMany } };
    await closeListingsForItem(tx as never, 7);
    const arg = m.txListingUpdateMany.mock.calls[0][0];
    expect(arg.where.gearItemId).toBe(7);
    expect(arg.where.status.in).toEqual(["DRAFT", "IN_REVIEW", "PUBLISHED", "PAUSED"]);
    expect(arg.data.status).toBe("CLOSED");
  });

  it("listSellerListings ordena por fecha y nunca devuelve reviewNote", async () => {
    m.listingFindMany.mockResolvedValue([{ id: 1, status: "IN_REVIEW", reviewNote: "Denuncia activa #3" }]);
    const r = await listSellerListings(1);
    expect(m.listingFindMany.mock.calls[0][0]).toMatchObject({
      where: { sellerId: 1 },
      orderBy: { createdAt: "desc" },
    });
    expect(r[0].reviewNote).toBeNull();
  });
});

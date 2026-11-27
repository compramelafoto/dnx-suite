import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeGearSerial } from "@repo/gear/serial";

const m = vi.hoisted(() => ({
  sightingFindMany: vi.fn(),
  sightingFindFirst: vi.fn(),
  dismissalFindMany: vi.fn(),
  dismissalUpsert: vi.fn(),
  itemFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  itemFindUnique: vi.fn(),
  listingFindFirst: vi.fn(),
  saleFindFirst: vi.fn(),
  txItemCreate: vi.fn(),
  txItemUpdate: vi.fn(),
  txEventCreate: vi.fn(),
  eventFindMany: vi.fn(),
  eventFindFirst: vi.fn(),
  tx: vi.fn(),
  upload: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearSerialSighting: { findMany: m.sightingFindMany, findFirst: m.sightingFindFirst },
    gearSightingDismissal: { findMany: m.dismissalFindMany, upsert: m.dismissalUpsert },
    gearItem: { findFirst: m.itemFindFirst, findMany: m.itemFindMany, findUnique: m.itemFindUnique },
    gearItemEvent: { findMany: m.eventFindMany, findFirst: m.eventFindFirst },
    gearListing: { findFirst: m.listingFindFirst },
    gearSale: { findFirst: m.saleFindFirst },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/archivos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archivos")>("@/lib/archivos");
  return { ...actual, uploadPrivateFile: m.upload };
});
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import {
  attachItemPhoto,
  attachPurchaseProof,
  confirmSighting,
  createManualItem,
  dismissSighting,
  listItemHistory,
  updateItem,
} from "./equipos";
import { listSightingSuggestions } from "./sugerencias";

const file = (type: string, size = 10) => new File([new Uint8Array(size)], "x", { type });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = "admin@dnx.test";
  process.env.CLF_URL = "https://clf.test/";
  m.listingFindFirst.mockResolvedValue(null);
  m.saleFindFirst.mockResolvedValue(null);
  m.eventFindFirst.mockResolvedValue(null);
  m.tx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      gearItem: { create: m.txItemCreate, update: m.txItemUpdate },
      gearItemEvent: { create: m.txEventCreate },
    }),
  );
  m.txItemCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 50,
    photoKeys: [],
    ...data,
  }));
  m.txItemUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 7,
    ...data,
  }));
  m.txEventCreate.mockResolvedValue({});
  m.itemFindFirst.mockResolvedValue(null);
  m.email.mockResolvedValue({ success: true });
});

describe("listSightingSuggestions", () => {
  it("sólo trae series del usuario, sin las ya confirmadas ni las descartadas", async () => {
    m.dismissalFindMany.mockResolvedValue([{ sightingId: 3 }, { sightingId: 9 }]);
    m.sightingFindMany.mockResolvedValue([
      {
        id: 4,
        kind: "BODY",
        make: "Canon",
        model: "R6",
        serialRaw: "123456",
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-02-01"),
        photosCount: 12,
        extra: "no",
      },
    ]);
    const r = await listSightingSuggestions(1);
    expect(m.dismissalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    const where = m.sightingFindMany.mock.calls[0][0].where;
    expect(where.photographerId).toBe(1);
    expect(where.id).toEqual({ notIn: [3, 9] });
    expect(where.gearItem).toEqual({ is: null });
    expect(r).toEqual([
      {
        sightingId: 4,
        kind: "BODY",
        make: "Canon",
        model: "R6",
        serialRaw: "123456",
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-02-01"),
        photosCount: 12,
      },
    ]);
  });
});

describe("createManualItem", () => {
  it(" 0123-45  se guarda normalizada con la función real de @repo/gear", async () => {
    const esperado = normalizeGearSerial(" 0123-45 ");
    expect(esperado).toBe("12345");
    await createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", serialRaw: " 0123-45 " });
    const data = m.txItemCreate.mock.calls[0][0].data;
    expect(data.serialNormalized).toBe(esperado);
    expect(data.ownerId).toBe(1);
    expect(data.source).toBe("MANUAL");
    expect(m.txEventCreate.mock.calls[0][0].data).toMatchObject({ gearItemId: 50, type: "CREATED" });
  });

  it("variantes de la misma serie se normalizan igual y disparan el conflicto con el mismo valor", async () => {
    expect(normalizeGearSerial("0123-45")).toBe(normalizeGearSerial("012345"));
    expect(normalizeGearSerial("012345")).toBe(normalizeGearSerial(" 012345 "));
    const n = normalizeGearSerial(" 012345 ");
    // Otro usuario ya tiene el equipo guardado desde " 012345 " (mismo serialNormalized).
    m.itemFindFirst.mockResolvedValue({ id: 99, serialNormalized: n });
    await createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", serialRaw: "0123-45" });
    expect(m.txItemCreate.mock.calls[0][0].data.serialNormalized).toBe(n);
    expect(m.itemFindFirst.mock.calls[0][0].where).toEqual({
      serialNormalized: n,
      ownerId: { not: 1 },
    });
    expect(m.email).toHaveBeenCalledTimes(1);
  });

  it("serie muy corta queda sin normalizar (null)", async () => {
    await createManualItem(1, { kind: "BAG", make: "Lowepro", model: "Pro", serialRaw: "12" });
    expect(m.txItemCreate.mock.calls[0][0].data.serialNormalized).toBeNull();
  });

  it("rechaza marca o modelo vacíos y montos no enteros", async () => {
    await expect(
      createManualItem(1, { kind: "BODY", make: " ", model: "R6" }),
    ).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    await expect(
      createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", declaredValueArs: 10.5 }),
    ).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    await expect(
      createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", declaredValueUsd: -1 }),
    ).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("si la serie ya está en el inventario de OTRO usuario, crea igual y avisa al admin sin datos personales en el asunto", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 99 });
    const item = await createManualItem(1, {
      kind: "BODY",
      make: "Canon",
      model: "R6",
      serialRaw: "ABC-12345",
    });
    expect(item.id).toBe(50);
    expect(m.itemFindFirst.mock.calls[0][0].where).toEqual({
      serialNormalized: "ABC12345",
      ownerId: { not: 1 },
    });
    expect(m.email).toHaveBeenCalledTimes(1);
    const [to, template, data] = m.email.mock.calls[0];
    expect(to).toBe("admin@dnx.test");
    expect(template).toBe("conflicto_serie_admin");
    expect(Object.values(data as Record<string, string>).join(" ")).toContain("ABC12345");
    expect((data as { url: string }).url).toBe("https://clf.test/admin/equipos-robados");
  });

  it("sin CLF_URL, el aviso al admin no lleva enlace", async () => {
    const prev = process.env.CLF_URL;
    delete process.env.CLF_URL;
    m.itemFindFirst.mockResolvedValue({ id: 99 });
    await createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", serialRaw: "ABC-12345" });
    expect((m.email.mock.calls[0][2] as { url: string }).url).toBe("");
    process.env.CLF_URL = prev;
  });

  it("si el aviso falla, no frena la creación", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 99 });
    m.email.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", serialRaw: "ABC-12345" }),
    ).resolves.toMatchObject({ id: 50 });
    spy.mockRestore();
  });

  it("sin conflicto no manda correo", async () => {
    await createManualItem(1, { kind: "BODY", make: "Canon", model: "R6", serialRaw: "ABC-12345" });
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("confirmSighting", () => {
  const sighting = {
    id: 4,
    kind: "LENS",
    make: "Sigma",
    model: "35mm",
    serialRaw: "0099887",
    serialNormalized: "99887",
    photographerId: 1,
  };

  it("crea el equipo desde CLF con evento CONFIRMED_FROM_CLF", async () => {
    m.sightingFindFirst.mockResolvedValue(sighting);
    m.itemFindUnique.mockResolvedValue(null);
    await confirmSighting(1, 4);
    expect(m.sightingFindFirst.mock.calls[0][0].where).toEqual({ id: 4, photographerId: 1 });
    const data = m.txItemCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      ownerId: 1,
      kind: "LENS",
      source: "CLF_SIGHTING",
      sightingId: 4,
      serialNormalized: "99887",
    });
    expect(m.txEventCreate.mock.calls[0][0].data.type).toBe("CONFIRMED_FROM_CLF");
  });

  it("una serie vista de otro usuario → NO_ENCONTRADO", async () => {
    m.sightingFindFirst.mockResolvedValue(null);
    await expect(confirmSighting(1, 4)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("si ya estaba confirmada devuelve el mismo equipo sin duplicar", async () => {
    m.sightingFindFirst.mockResolvedValue(sighting);
    m.itemFindUnique.mockResolvedValue({ id: 8, ownerId: 1 });
    const r = await confirmSighting(1, 4);
    expect(r.id).toBe(8);
    expect(m.tx).not.toHaveBeenCalled();
  });
});

describe("dismissSighting", () => {
  it("registra el descarte del usuario", async () => {
    m.sightingFindFirst.mockResolvedValue({ id: 4 });
    m.dismissalUpsert.mockResolvedValue({});
    await dismissSighting(1, 4);
    expect(m.dismissalUpsert.mock.calls[0][0].where).toEqual({
      userId_sightingId: { userId: 1, sightingId: 4 },
    });
  });
  it("ajena → NO_ENCONTRADO", async () => {
    m.sightingFindFirst.mockResolvedValue(null);
    await expect(dismissSighting(1, 4)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.dismissalUpsert).not.toHaveBeenCalled();
  });
});

describe("updateItem", () => {
  it("sobre un equipo ajeno → NO_ENCONTRADO (filtra por ownerId)", async () => {
    m.itemFindFirst.mockResolvedValue(null);
    await expect(updateItem(1, 7, { notes: "x" })).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.itemFindFirst.mock.calls[0][0].where).toEqual({ id: 7, ownerId: 1 });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("actualiza y registra UPDATED en la misma transacción", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, status: "IN_USE", serialNormalized: null });
    await updateItem(1, 7, { notes: "nuevo", declaredValueArs: 1500000 });
    expect(m.tx).toHaveBeenCalledTimes(1);
    expect(m.txItemUpdate.mock.calls[0][0].data).toMatchObject({
      notes: "nuevo",
      declaredValueArs: 1500000,
    });
    expect(m.txEventCreate.mock.calls[0][0].data.type).toBe("UPDATED");
  });

  it("cambio de estado registra STATUS_CHANGED y no admite estados de denuncia", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, status: "IN_USE", serialNormalized: null });
    await updateItem(1, 7, { status: "FOR_SALE" });
    expect(m.txEventCreate.mock.calls[0][0].data.type).toBe("STATUS_CHANGED");
    await expect(updateItem(1, 7, { status: "STOLEN" })).rejects.toMatchObject({
      code: "DATO_INVALIDO",
    });
  });

  it("estado manual con publicación activa → CON_PUBLICACION", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, status: "FOR_SALE", serialNormalized: null });
    m.listingFindFirst.mockResolvedValue({ id: 70, status: "PUBLISHED" });
    await expect(updateItem(1, 7, { status: "IN_USE" })).rejects.toMatchObject({
      code: "CON_PUBLICACION",
      message: "Este equipo tiene una publicación activa; pausala o cerrala primero.",
    });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("estado manual con una venta pendiente de confirmación → CON_PUBLICACION", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, status: "FOR_SALE", serialNormalized: null });
    m.listingFindFirst.mockResolvedValue(null);
    m.saleFindFirst.mockResolvedValue({ id: 500 });
    await expect(updateItem(1, 7, { status: "IN_USE" })).rejects.toMatchObject({
      code: "CON_PUBLICACION",
    });
    expect(m.saleFindFirst.mock.calls[0][0].where).toEqual({ gearItemId: 7, status: "PENDING_BUYER" });
    expect(m.tx).not.toHaveBeenCalled();
  });

  const conPublicacion = {
    id: 7,
    ownerId: 1,
    status: "FOR_SALE",
    kind: "BODY",
    make: "Canon",
    model: "R5",
    serialRaw: "AB123",
    serialNormalized: "AB123",
  };

  it("con publicación abierta, reenviar el mismo estado y cambiar notas o valor se guarda", async () => {
    m.itemFindFirst.mockResolvedValue(conPublicacion);
    m.listingFindFirst.mockResolvedValue({ id: 70 });
    await updateItem(1, 7, {
      status: "FOR_SALE",
      kind: "BODY",
      make: "Canon",
      model: "R5",
      serialRaw: "AB123",
      notes: "Con funda",
      declaredValueArs: 2000000,
    });
    expect(m.txItemUpdate.mock.calls[0][0].data).toMatchObject({
      notes: "Con funda",
      declaredValueArs: 2000000,
    });
    expect(m.txEventCreate.mock.calls[0][0].data.type).toBe("UPDATED");
  });

  it.each([
    ["serie", { serialRaw: "ZZ999" }],
    ["tipo", { kind: "LENS" as const }],
    ["marca", { make: "Nikon" }],
    ["modelo", { model: "R6" }],
  ])("con publicación abierta, cambiar %s → CON_PUBLICACION", async (_n, patch) => {
    m.itemFindFirst.mockResolvedValue(conPublicacion);
    m.listingFindFirst.mockResolvedValue({ id: 70 });
    await expect(updateItem(1, 7, { status: "FOR_SALE", ...patch })).rejects.toMatchObject({
      code: "CON_PUBLICACION",
      message: "Este equipo tiene una publicación abierta: cerrala antes de cambiar sus datos de identidad.",
    });
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({
      gearItemId: 7,
      status: { in: ["IN_REVIEW", "PUBLISHED", "PAUSED"] },
    });
    expect(m.tx).not.toHaveBeenCalled();
  });

  it("cambiar la serie de un equipo que tuvo una publicación retenida avisa al admin", async () => {
    m.itemFindFirst.mockResolvedValue({ ...conPublicacion, status: "IN_USE" });
    m.listingFindFirst.mockResolvedValue(null); // ninguna abierta
    m.eventFindFirst.mockResolvedValue({ id: 3 }); // evento «retenido»
    await updateItem(1, 7, { serialRaw: "ZZ999" });
    expect(m.eventFindFirst.mock.calls[0][0].where).toEqual({
      gearItemId: 7,
      detail: { path: ["accion"], equals: "retenido" },
    });
    const avisos = m.email.mock.calls.filter((c) => c[1] === "cambio_serie_admin");
    expect(avisos).toHaveLength(1);
    expect(avisos[0][0]).toBe("admin@dnx.test");
    expect(avisos[0][2].detalle).toContain("AB123");
    expect(avisos[0][2].detalle).toContain("ZZ999");
  });

  it("también avisa si la retención quedó sólo en la nota «Denuncia activa»", async () => {
    m.itemFindFirst.mockResolvedValue({ ...conPublicacion, status: "IN_USE" });
    m.listingFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 70 });
    await updateItem(1, 7, { serialRaw: "ZZ999" });
    expect(m.listingFindFirst.mock.calls[1][0].where).toEqual({
      gearItemId: 7,
      reviewNote: { contains: "Denuncia activa" },
    });
    expect(m.email.mock.calls.map((c) => c[1])).toContain("cambio_serie_admin");
  });

  it("cambiar la serie sin retenciones previas no manda ese aviso", async () => {
    m.itemFindFirst.mockResolvedValue({ ...conPublicacion, status: "IN_USE" });
    await updateItem(1, 7, { serialRaw: "ZZ999" });
    expect(m.email.mock.calls.map((c) => c[1])).not.toContain("cambio_serie_admin");
  });

  it("al cambiar la serie la normaliza y revisa conflicto", async () => {
    m.itemFindFirst
      .mockResolvedValueOnce({ id: 7, ownerId: 1, status: "IN_USE", serialNormalized: null })
      .mockResolvedValueOnce({ id: 99 });
    await updateItem(1, 7, { serialRaw: "xyz-9999" });
    expect(m.txItemUpdate.mock.calls[0][0].data.serialNormalized).toBe("XYZ9999");
    expect(m.email).toHaveBeenCalledTimes(1);
  });
});

describe("attachItemPhoto", () => {
  it("agrega la clave a photoKeys", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, photoKeys: ["equipos/a.jpg"] });
    m.upload.mockResolvedValue({ key: "equipos/b.jpg", mime: "image/jpeg" });
    await attachItemPhoto(1, 7, file("image/jpeg"));
    expect(m.txItemUpdate.mock.calls[0][0].data.photoKeys).toEqual([
      "equipos/a.jpg",
      "equipos/b.jpg",
    ]);
  });
  it("máximo 6 fotos: no sube la séptima", async () => {
    m.itemFindFirst.mockResolvedValue({
      id: 7,
      ownerId: 1,
      photoKeys: ["1", "2", "3", "4", "5", "6"],
    });
    await expect(attachItemPhoto(1, 7, file("image/jpeg"))).rejects.toMatchObject({
      code: "LIMITE_FOTOS",
    });
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("PDF no sirve como foto", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, photoKeys: [] });
    await expect(attachItemPhoto(1, 7, file("application/pdf"))).rejects.toMatchObject({
      code: "ARCHIVO_INVALIDO",
    });
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("equipo ajeno → NO_ENCONTRADO sin subir nada", async () => {
    m.itemFindFirst.mockResolvedValue(null);
    await expect(attachItemPhoto(1, 7, file("image/jpeg"))).rejects.toMatchObject({
      code: "NO_ENCONTRADO",
    });
    expect(m.upload).not.toHaveBeenCalled();
  });
});

describe("attachPurchaseProof", () => {
  it("guarda clave y mime y registra PROOF_ADDED", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, photoKeys: [] });
    m.upload.mockResolvedValue({ key: "equipos/f.pdf", mime: "application/pdf" });
    await attachPurchaseProof(1, 7, file("application/pdf"));
    expect(m.txItemUpdate.mock.calls[0][0].data).toEqual({
      purchaseProofKey: "equipos/f.pdf",
      purchaseProofMime: "application/pdf",
    });
    expect(m.txEventCreate.mock.calls[0][0].data.type).toBe("PROOF_ADDED");
  });
  it("más de 4 MB → ARCHIVO_INVALIDO", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1, photoKeys: [] });
    await expect(
      attachPurchaseProof(1, 7, file("application/pdf", 4 * 1024 * 1024 + 1)),
    ).rejects.toMatchObject({ code: "ARCHIVO_INVALIDO" });
    expect(m.upload).not.toHaveBeenCalled();
  });
});

describe("updateItem con el equipo robado o perdido", () => {
  const stolen = { id: 7, ownerId: 1, status: "STOLEN", kind: "BODY", make: "Canon", model: "R5", serialNormalized: "AB123", serialRaw: "AB123" };
  it.each([
    ["estado", { status: "IN_USE" as const }],
    ["serie", { serialRaw: "ZZ999" }],
    ["tipo", { kind: "LENS" as const }],
    ["marca", { make: "Nikon" }],
    ["modelo", { model: "Z9" }],
  ])("rechaza cambiar %s con EN_DENUNCIA", async (_n, patch) => {
    m.itemFindFirst.mockResolvedValue(stolen);
    await expect(updateItem(1, 7, patch)).rejects.toMatchObject({ code: "EN_DENUNCIA" });
    expect(m.tx).not.toHaveBeenCalled();
  });
  it("permite editar notas (y reenviar los mismos datos)", async () => {
    m.itemFindFirst.mockResolvedValue(stolen);
    await updateItem(1, 7, { notes: "ok", make: "Canon", model: "R5", kind: "BODY", serialRaw: "AB123" });
    expect(m.txItemUpdate).toHaveBeenCalled();
  });
});

describe("listItemHistory", () => {
  it("nunca devuelve los eventos de cruce (matchReportId)", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1 });
    m.eventFindMany.mockResolvedValue([
      { id: 1, type: "UPDATED", detail: { matchReportId: 3 } },
      { id: 2, type: "UPDATED", detail: { fields: ["notes"] } },
      { id: 3, type: "CREATED", detail: null },
    ]);
    const r = await listItemHistory(1, 7);
    expect(r.map((e) => e.id)).toEqual([2, 3]);
  });
  it("equipo ajeno → NO_ENCONTRADO", async () => {
    m.itemFindFirst.mockResolvedValue(null);
    await expect(listItemHistory(1, 7)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.eventFindMany).not.toHaveBeenCalled();
  });
  it("devuelve los eventos más nuevos primero", async () => {
    m.itemFindFirst.mockResolvedValue({ id: 7, ownerId: 1 });
    m.eventFindMany.mockResolvedValue([]);
    await listItemHistory(1, 7);
    expect(m.eventFindMany.mock.calls[0][0]).toMatchObject({
      where: { gearItemId: 7 },
      orderBy: { createdAt: "desc" },
    });
  });
});

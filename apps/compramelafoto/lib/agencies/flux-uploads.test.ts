import { beforeEach, describe, expect, it, vi } from "vitest";

const photoFindMany = vi.fn();
const upFindMany = vi.fn();
const upFindFirst = vi.fn();
const upCreate = vi.fn();
const upUpdate = vi.fn();
const upUpdateMany = vi.fn();
const placeFindFirst = vi.fn();
const jobFindUnique = vi.fn();
const signPut = vi.fn();
const deleteR2 = vi.fn();
const target = vi.fn();
const ensureMp = vi.fn();
const enqueue = vi.fn();
const awaitsFilterMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { findMany: (...a: unknown[]) => photoFindMany(...a) },
    agencyFluxUpload: {
      findMany: (...a: unknown[]) => upFindMany(...a),
      findFirst: (...a: unknown[]) => upFindFirst(...a),
      create: (...a: unknown[]) => upCreate(...a),
      update: (...a: unknown[]) => upUpdate(...a),
      updateMany: (...a: unknown[]) => upUpdateMany(...a),
    },
    agencyPlace: { findFirst: (...a: unknown[]) => placeFindFirst(...a) },
    cameraIngestJob: { findUnique: (...a: unknown[]) => jobFindUnique(...a) },
  },
}));
vi.mock("@/lib/r2-client", () => ({
  generateR2Key: (name: string, prefix: string) => `${prefix}/uuid-${name}`,
  getSignedPutUrl: (...a: unknown[]) => signPut(...a),
  deleteFromR2: (...a: unknown[]) => deleteR2(...a),
}));
vi.mock("@/lib/agencies/upload-target", () => ({ checkAgencyUploadTarget: (...a: unknown[]) => target(...a) }));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));
vi.mock("@/lib/albums/enqueue-album-photo-ingest", () => ({ enqueueAlbumPhotoIngest: (...a: unknown[]) => enqueue(...a) }));
vi.mock("@/lib/agencies/publish-mode", () => ({ agencyAwaitsFilter: (...a: unknown[]) => awaitsFilterMock(...a) }));

import { confirmFluxUpload, requestFluxUploads, resolveFluxPoint, validateFluxFiles } from "./flux-uploads";

const ctx = { deviceKeyId: 33, userId: 20, role: "PHOTOGRAPHER" } as const;
const tgt = { agencyId: 3, albumId: 50 };
const H = "a".repeat(64);

beforeEach(() => {
  for (const f of [photoFindMany, upFindMany, upFindFirst, upCreate, upUpdate, upUpdateMany, placeFindFirst, jobFindUnique, signPut, deleteR2, target, ensureMp, enqueue, awaitsFilterMock]) f.mockReset();
  photoFindMany.mockResolvedValue([]);
  upFindMany.mockResolvedValue([]);
  let n = 0;
  upCreate.mockImplementation(async () => ({ id: `up${++n}` }));
  upUpdate.mockResolvedValue({});
  upUpdateMany.mockResolvedValue({ count: 1 });
  signPut.mockImplementation(async (key: string) => `https://r2/${key}?firma`);
  deleteR2.mockResolvedValue(undefined);
  target.mockResolvedValue({ ok: true });
  ensureMp.mockResolvedValue({ ok: true, error: null });
  awaitsFilterMock.mockResolvedValue(false);
});

describe("validateFluxFiles", () => {
  it("acepta JPG de hasta 10 MB y normaliza la huella", () => {
    expect(validateFluxFiles([{ name: "DSC_0001.JPG", size: 5_000_000, contentType: "image/jpeg", sha256: H.toUpperCase() }])).toEqual({
      ok: true,
      files: [{ name: "DSC_0001.JPG", size: 5_000_000, sha256: H }],
    });
  });
  it("rechaza la tanda entera si un archivo no es JPG, pesa de más, no tiene tamaño o la huella está mal", () => {
    const ok = { name: "a.jpg", size: 1000, contentType: "image/jpeg" };
    expect(validateFluxFiles([ok, { ...ok, name: "a.png", contentType: "image/png" }])).toMatchObject({ ok: false, error: expect.stringContaining("JPG") });
    expect(validateFluxFiles([{ ...ok, name: "a.heic", contentType: "image/jpeg" }])).toMatchObject({ ok: false });
    expect(validateFluxFiles([{ ...ok, size: 10 * 1024 * 1024 + 1 }])).toMatchObject({ ok: false, error: expect.stringContaining("10 MB") });
    expect(validateFluxFiles([{ ...ok, size: 0 }])).toMatchObject({ ok: false });
    expect(validateFluxFiles([{ ...ok, sha256: "xyz" }])).toMatchObject({ ok: false });
    expect(validateFluxFiles([])).toMatchObject({ ok: false });
    expect(validateFluxFiles(Array.from({ length: 51 }, () => ok))).toMatchObject({ ok: false });
    expect(validateFluxFiles("hola")).toMatchObject({ ok: false });
  });
  it("se queda sólo con el nombre del archivo, sin carpetas", () => {
    expect(validateFluxFiles([{ name: "C:\\DCIM\\100NIKON\\DSC_1.jpg", size: 10, contentType: "image/jpeg" }])).toEqual({
      ok: true, files: [{ name: "DSC_1.jpg", size: 10, sha256: null }],
    });
  });
});

describe("resolveFluxPoint", () => {
  it("sin punto: null", async () => {
    expect(await resolveFluxPoint(3, {})).toEqual({ ok: true, point: null });
  });
  it("lugar de la agencia: su punto; lugar ajeno: error", async () => {
    placeFindFirst.mockResolvedValue({ lat: -38.02, lng: -57.53 });
    expect(await resolveFluxPoint(3, { placeId: 1 })).toEqual({ ok: true, point: { lat: -38.02, lng: -57.53 } });
    expect(placeFindFirst.mock.calls[0][0].where).toEqual({ id: 1, agencyId: 3 });
    placeFindFirst.mockClear();
    expect(await resolveFluxPoint(3, { placeId: true })).toMatchObject({ ok: false });
    expect(placeFindFirst).not.toHaveBeenCalled();
    placeFindFirst.mockResolvedValue(null);
    expect(await resolveFluxPoint(3, { placeId: 9 })).toMatchObject({ ok: false });
  });
  it("lat/lng válidos: el punto; inválidos o a medias: error (no se ignora en silencio)", async () => {
    expect(await resolveFluxPoint(3, { lat: -38.02, lng: -57.53 })).toEqual({ ok: true, point: { lat: -38.02, lng: -57.53 } });
    expect(await resolveFluxPoint(3, { lat: 200, lng: 0 })).toMatchObject({ ok: false });
    expect(await resolveFluxPoint(3, { lat: -38 })).toMatchObject({ ok: false });
  });
});

describe("requestFluxUploads", () => {
  const f1 = { name: "DSC_1.JPG", size: 100, sha256: H };
  const f2 = { name: "DSC_2.JPG", size: 200, sha256: null };

  it("archivos nuevos: una fila por archivo con su rawKey en el álbum y URL firmada de 15 minutos", async () => {
    const items = await requestFluxUploads(ctx, tgt, [f1, f2], { lat: -38, lng: -57.5 });
    expect(items).toEqual([
      { uploadId: "up1", uploadUrl: "https://r2/albums/50/raw/uuid-DSC_1.JPG?firma", method: "PUT", headers: { "Content-Type": "image/jpeg" }, expiresInSeconds: 900 },
      { uploadId: "up2", uploadUrl: "https://r2/albums/50/raw/uuid-DSC_2.JPG?firma", method: "PUT", headers: { "Content-Type": "image/jpeg" }, expiresInSeconds: 900 },
    ]);
    expect(upCreate.mock.calls[0][0].data).toEqual({
      deviceKeyId: 33, userId: 20, agencyId: 3, albumId: 50, rawKey: "albums/50/raw/uuid-DSC_1.JPG",
      originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, declaredLat: -38, declaredLng: -57.5,
    });
    expect(signPut).toHaveBeenCalledWith("albums/50/raw/uuid-DSC_1.JPG", "image/jpeg", 900, 100);
  });
  it("la huella ya está publicada en el álbum: alreadyThere sin crear fila", async () => {
    photoFindMany.mockResolvedValue([{ contentSha256: H }]);
    expect(await requestFluxUploads(ctx, tgt, [f1], null)).toEqual([{ alreadyThere: true }]);
    expect(photoFindMany.mock.calls[0][0].where).toEqual({ albumId: 50, isRemoved: false, contentSha256: { in: [H] } });
    expect(upCreate).not.toHaveBeenCalled();
  });
  it("retoma: la fila sin confirmar se reusa con URL nueva; la confirmada responde alreadyThere", async () => {
    upFindMany.mockResolvedValue([
      { id: "old1", rawKey: "albums/50/raw/k1", originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, status: "UPLOADING" },
      { id: "old2", rawKey: "albums/50/raw/k2", originalFilename: "DSC_2.JPG", sizeBytes: 200, contentSha256: null, status: "CONFIRMED" },
    ]);
    const items = await requestFluxUploads(ctx, tgt, [f1, f2], null);
    expect(items[0]).toMatchObject({ uploadId: "old1", uploadUrl: "https://r2/albums/50/raw/k1?firma" });
    expect(items[1]).toEqual({ alreadyThere: true });
    expect(upCreate).not.toHaveBeenCalled();
    expect(upFindMany.mock.calls[0][0].where).toMatchObject({ userId: 20, albumId: 50 });
    expect(signPut).toHaveBeenCalledWith("albums/50/raw/k1", "image/jpeg", 900, 100);
    expect(upUpdate).toHaveBeenCalledWith({ where: { id: "old1" }, data: { deviceKeyId: 33, declaredLat: null, declaredLng: null } });
  });
  it("una fila rechazada (pesaba de más) no se reusa: se arma una nueva", async () => {
    upFindMany.mockResolvedValue([{ id: "old1", rawKey: "k", originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, status: "REJECTED" }]);
    expect(await requestFluxUploads(ctx, tgt, [f1], null)).toEqual([expect.objectContaining({ uploadId: "up1" })]);
  });
  it("una fila rechazada más nueva no tapa a una confirmada anterior", async () => {
    upFindMany.mockResolvedValue([
      { id: "new", rawKey: "k2", originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, status: "REJECTED" },
      { id: "old", rawKey: "k1", originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, status: "CONFIRMED" },
    ]);
    expect(await requestFluxUploads(ctx, tgt, [f1], null)).toEqual([{ alreadyThere: true }]);
    expect(upCreate).not.toHaveBeenCalled();
  });
  it("el mismo archivo dos veces en la tanda: una sola fila, la misma respuesta", async () => {
    const items = await requestFluxUploads(ctx, tgt, [f1, f1], null);
    expect(upCreate).toHaveBeenCalledTimes(1);
    expect(items[1]).toEqual(items[0]);
  });
});

describe("confirmFluxUpload", () => {
  const up = {
    id: "up1", userId: 20, agencyId: 3, albumId: 50, rawKey: "albums/50/raw/uuid-DSC_1.JPG", originalFilename: "DSC_1.JPG",
    deviceKeyId: 33, declaredLat: -38, declaredLng: -57.5, status: "UPLOADING", ingestJobId: null,
  };

  beforeEach(() => {
    upFindFirst.mockResolvedValue(up);
    enqueue.mockResolvedValue({ job: { id: "j1", status: "PENDING" }, created: true });
  });

  it("id mal formado: 400; ajena o inexistente: 404 (busca con el usuario de la llave)", async () => {
    expect((await confirmFluxUpload(ctx, "../x")).status).toBe(400);
    upFindFirst.mockResolvedValue(null);
    expect((await confirmFluxUpload(ctx, "up9")).status).toBe(404);
    expect(upFindFirst.mock.calls[0][0].where).toEqual({ id: "up9", userId: 20 });
  });
  it("válida: encola FLUX con autor, álbum, punto y llave, y la marca confirmada una sola vez", async () => {
    expect(await confirmFluxUpload(ctx, "up1")).toEqual({ status: 200, body: { ok: true, state: "QUEUED" } });
    expect(enqueue).toHaveBeenCalledWith({
      userId: 20, albumId: 50, rawKey: "albums/50/raw/uuid-DSC_1.JPG", originalFilename: "DSC_1.JPG",
      source: "FLUX", declaredPoint: { lat: -38, lng: -57.5 }, agencyDeviceKeyId: 33, awaitFilter: false,
    });
    expect(upUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "up1", status: "UPLOADING" },
      data: { status: "CONFIRMED", ingestJobId: "j1", confirmedAt: expect.any(Date) },
    });
  });
  it("agencia que espera al filtro: estado AWAITING_FILTER", async () => {
    awaitsFilterMock.mockResolvedValue(true);
    enqueue.mockResolvedValue({ job: { id: "j1", status: "AWAITING_FILTER" }, created: true });
    expect((await confirmFluxUpload(ctx, "up1")).body).toEqual({ ok: true, state: "AWAITING_FILTER" });
    expect(enqueue.mock.calls[0][0].awaitFilter).toBe(true);
  });
  it("confirmada dos veces: no vuelve a encolar", async () => {
    upFindFirst.mockResolvedValue({ ...up, status: "CONFIRMED", ingestJobId: "j1" });
    jobFindUnique.mockResolvedValue({ status: "COMPLETED" });
    expect(await confirmFluxUpload(ctx, "up1")).toEqual({ status: 200, body: { ok: true, state: "QUEUED", alreadyConfirmed: true } });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("lo dieron de baja entre la tanda y la confirmación: 403 sin encolar", async () => {
    target.mockResolvedValue({ ok: false, message: "Ya no podés subir a ese álbum de la agencia." });
    expect(await confirmFluxUpload(ctx, "up1")).toEqual({ status: 403, body: { error: "Ya no podés subir a ese álbum de la agencia." } });
    expect(target).toHaveBeenCalledWith(3, 50, 20);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("el archivo no llegó a R2: 409 y la fila sigue esperando", async () => {
    enqueue.mockRejectedValue(Object.assign(new Error("NotFound"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }));
    expect(await confirmFluxUpload(ctx, "up1")).toMatchObject({ status: 409, body: { ok: false, state: "PENDING_UPLOAD" } });
    expect(upUpdateMany).not.toHaveBeenCalled();
    expect(upUpdate).not.toHaveBeenCalled();
  });
  it("subió algo de más de 10 MB: 422, fila REJECTED y se borra el archivo", async () => {
    enqueue.mockRejectedValue(new Error("El archivo supera el límite de 10MB."));
    expect(await confirmFluxUpload(ctx, "up1")).toMatchObject({ status: 422, body: { ok: false, state: "REJECTED" } });
    expect(upUpdate).toHaveBeenCalledWith({ where: { id: "up1" }, data: { status: "REJECTED" } });
    expect(deleteR2).toHaveBeenCalledWith("albums/50/raw/uuid-DSC_1.JPG");
  });
});

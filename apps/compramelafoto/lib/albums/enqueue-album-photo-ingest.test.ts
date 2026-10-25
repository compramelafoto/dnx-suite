import { beforeEach, describe, expect, it, vi } from "vitest";

const jobFindUnique = vi.fn();
const jobCreate = vi.fn();
const getMeta = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { cameraIngestJob: { findUnique: (...a: unknown[]) => jobFindUnique(...a), create: (...a: unknown[]) => jobCreate(...a) } },
  AlbumPhotoIngestSource: { CAMERA: "CAMERA", WEB_UPLOAD: "WEB_UPLOAD", FLUX: "FLUX" },
}));
vi.mock("@/lib/r2-client", () => ({ getR2ObjectMetadata: (...a: unknown[]) => getMeta(...a) }));

import { enqueueAlbumPhotoIngest } from "./enqueue-album-photo-ingest";

const base = { userId: 20, albumId: 50, rawKey: "albums/50/raw/abc-DSC_1.jpg", originalFilename: "DSC_1.JPG" };

beforeEach(() => {
  for (const f of [jobFindUnique, jobCreate, getMeta]) f.mockReset();
  jobFindUnique.mockResolvedValue(null);
  jobCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "j1", ...data }));
  getMeta.mockResolvedValue({ size: 2_000_000, contentType: "image/jpeg" });
});

describe("enqueueAlbumPhotoIngest", () => {
  it("sin opciones nuevas: los mismos datos que antes (subida web, PENDING)", async () => {
    await enqueueAlbumPhotoIngest(base);
    expect(jobCreate.mock.calls[0][0].data).toEqual({
      user: { connect: { id: 20 } },
      album: { connect: { id: 50 } },
      rawKey: "albums/50/raw/abc-DSC_1.jpg",
      source: "WEB_UPLOAD",
      status: "PENDING",
      originalFilename: "DSC_1.JPG",
      filesizeBytes: 2_000_000,
    });
  });
  it("DNX FLUX: origen FLUX, punto declarado y llave usada", async () => {
    await enqueueAlbumPhotoIngest({ ...base, source: "FLUX", declaredPoint: { lat: -38.02, lng: -57.53 }, agencyDeviceKeyId: 33 });
    expect(jobCreate.mock.calls[0][0].data).toMatchObject({
      source: "FLUX", status: "PENDING", declaredLat: -38.02, declaredLng: -57.53, agencyDeviceKeyId: 33,
    });
  });
  it("agencia que espera al filtro: el job nace AWAITING_FILTER", async () => {
    await enqueueAlbumPhotoIngest({ ...base, source: "FLUX", awaitFilter: true });
    expect(jobCreate.mock.calls[0][0].data.status).toBe("AWAITING_FILTER");
  });
  it("ya encolado con ese rawKey: devuelve el existente sin crear", async () => {
    jobFindUnique.mockResolvedValue({ id: "j0", status: "PENDING" });
    expect(await enqueueAlbumPhotoIngest({ ...base, source: "FLUX" })).toEqual({ job: { id: "j0", status: "PENDING" }, created: false });
    expect(jobCreate).not.toHaveBeenCalled();
  });
});

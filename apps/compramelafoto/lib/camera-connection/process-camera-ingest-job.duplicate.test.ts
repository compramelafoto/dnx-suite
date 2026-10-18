import { beforeEach, describe, expect, it, vi } from "vitest";

const finalize = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/albums/finalize-album-photo-from-raw", () => ({ finalizeAlbumPhotoFromRaw: (...a: unknown[]) => finalize(...a) }));
vi.mock("@/lib/albums/album-photo-upload-limits", () => ({ getAlbumPhotoMaxBytes: () => 10_000_000, getAlbumPhotoMaxMb: () => 10 }));

import { processClaimedCameraIngestJob } from "./process-camera-ingest-job";

const jobUpdate = vi.fn();
const logUpdate = vi.fn();
const client: any = {
  cameraIngestJob: { update: (...a: unknown[]) => jobUpdate(...a) },
  cameraUploadLog: { update: (...a: unknown[]) => logUpdate(...a) },
  cameraConnectionSettings: { updateMany: vi.fn() },
  $transaction: async (ops: unknown[]) => Promise.all(ops),
};
const job: any = {
  id: "j1", userId: 20, albumId: 5, rawKey: "albums/5/raw/x.jpg", attempts: 1,
  uploadLogId: 8, eventFolderId: null, folderId: null, originalFilename: "DSC_1.JPG",
};

beforeEach(() => {
  finalize.mockReset();
  jobUpdate.mockReset();
  logUpdate.mockReset();
});

describe("job de ingesta con foto repetida", () => {
  it("queda COMPLETED sin photoId, con motivo, y el log en éxito", async () => {
    finalize.mockResolvedValue({ photo: { id: 7, previewUrl: "p", originalKey: "o" }, duplicate: true });
    const r = await processClaimedCameraIngestJob({ CAMERA_INGEST_MAX_ATTEMPTS: 3 } as any, job, client);
    expect(r).toEqual({ ok: true, photoId: 7 });
    expect(finalize.mock.calls[0][0]).toMatchObject({ originalFilename: "DSC_1.JPG" });
    const done = jobUpdate.mock.calls.find((c) => c[0].data.status === "COMPLETED")![0].data;
    expect(done).not.toHaveProperty("photoId");
    expect(done.lastError).toContain("foto 7");
    expect(jobUpdate.mock.calls.some((c) => ["FAILED", "PENDING"].includes(c[0].data.status))).toBe(false);
    expect(logUpdate.mock.calls.some((c) => c[0].data.status === "SUCCESS")).toBe(true);
    expect(logUpdate.mock.calls.some((c) => c[0].data.status === "FAILED")).toBe(false);
  });
  it("foto nueva: guarda photoId como siempre", async () => {
    finalize.mockResolvedValue({ photo: { id: 9, previewUrl: "p", originalKey: "o" }, duplicate: false });
    await processClaimedCameraIngestJob({ CAMERA_INGEST_MAX_ATTEMPTS: 3 } as any, job, client);
    const done = jobUpdate.mock.calls.find((c) => c[0].data.status === "COMPLETED")![0].data;
    expect(done.photoId).toBe(9);
    expect(done.lastError).toBe(null);
  });
});

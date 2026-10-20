import { beforeEach, describe, expect, it, vi } from "vitest";

const photoCreate = vi.fn();
const photoFindFirst = vi.fn();
const jobCreate = vi.fn();
const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const findAgencyAlbumGate = vi.fn();
const extractPhotoFacts = vi.fn();
const deleteFromR2 = vi.fn();
const processPhoto = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { create: (...a: unknown[]) => photoCreate(...a), findFirst: (...a: unknown[]) => photoFindFirst(...a) },
    photoAnalysisJob: { create: (...a: unknown[]) => jobCreate(...a) },
    album: { findUnique: (...a: unknown[]) => albumFindUnique(...a), update: (...a: unknown[]) => albumUpdate(...a) },
  },
}));
vi.mock("@/lib/r2-client", () => ({
  getR2ObjectMetadata: async () => ({ size: 1000 }),
  readFromR2: async () => Buffer.from("foto"),
  deleteFromR2: (...a: unknown[]) => deleteFromR2(...a),
}));
vi.mock("@/lib/image-processing", () => ({ processPhoto: (...a: unknown[]) => processPhoto(...a) }));
vi.mock("@/lib/images/generate-photo-variants", () => ({ schedulePhotoVariantsOnUpload: () => {} }));
vi.mock("@/lib/photo-exif", () => ({ extractCapturedAtFromBuffer: async () => new Date("2027-01-10T15:00:00Z") }));
vi.mock("@/lib/platform-metrics", () => ({ incrementPhotosUploaded: async () => {} }));
vi.mock("@/lib/agencies/queries", () => ({ findAgencyAlbumGate: (...a: unknown[]) => findAgencyAlbumGate(...a) }));
vi.mock("@/lib/agencies/photo-facts", async (orig) => ({
  ...(await orig<typeof import("@/lib/agencies/photo-facts")>()),
  extractPhotoFacts: (...a: unknown[]) => extractPhotoFacts(...a),
}));

import { finalizeAlbumPhotoFromRaw } from "./finalize-album-photo-from-raw";

const base = { albumId: 5, userId: 20, key: "albums/5/raw/abc-DSC_0001.jpg", maxBytes: 10_000_000, maxMb: 10 };
const facts = { contentSha256: "h".repeat(64), cameraSerial: "S9", cameraImageNumber: 1, exifLat: null, exifLng: null };

beforeEach(() => {
  for (const f of [photoCreate, photoFindFirst, jobCreate, albumFindUnique, albumUpdate, findAgencyAlbumGate, extractPhotoFacts, deleteFromR2, processPhoto]) f.mockReset();
  processPhoto.mockResolvedValue({ previewUrl: "p.jpg", originalKey: "o.jpg" });
  photoCreate.mockImplementation(async ({ data }: any) => ({ id: 99, createdAt: new Date(), ...data }));
  albumFindUnique.mockResolvedValue({ coverPhotoId: 1, firstPhotoDate: new Date(), expiresAt: new Date() });
  extractPhotoFacts.mockResolvedValue(facts);
});

describe("finalizeAlbumPhotoFromRaw en álbumes de agencia", () => {
  it("álbum común: igual que antes (sin huella ni ubicación)", async () => {
    findAgencyAlbumGate.mockResolvedValue(null);
    const r = await finalizeAlbumPhotoFromRaw({ ...base, declaredPoint: { lat: -38, lng: -57 } });
    expect(r.duplicate).toBe(false);
    expect(extractPhotoFacts).not.toHaveBeenCalled();
    const data = photoCreate.mock.calls[0][0].data;
    for (const k of ["geoLat", "geoLng", "geoSource", "contentSha256", "cameraSerial", "cameraImageNumber", "originalFilename"]) {
      expect(data).not.toHaveProperty(k);
    }
  });
  it("álbum de agencia: guarda datos de cámara y el punto declarado", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue(null);
    const r = await finalizeAlbumPhotoFromRaw({ ...base, declaredPoint: { lat: -38.1, lng: -57.6 }, originalFilename: "DSC_0001.JPG" });
    expect(r.duplicate).toBe(false);
    expect(extractPhotoFacts).toHaveBeenCalledWith(expect.any(Buffer), "DSC_0001.JPG");
    expect(photoCreate.mock.calls[0][0].data).toMatchObject({
      geoLat: -38.1, geoLng: -57.6, geoSource: "DECLARED",
      contentSha256: "h".repeat(64), cameraSerial: "S9", cameraImageNumber: 1, originalFilename: "DSC_0001.JPG",
    });
  });
  it("álbum de agencia: el GPS de la foto le gana al punto declarado", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue(null);
    extractPhotoFacts.mockResolvedValue({ ...facts, exifLat: -38.0, exifLng: -57.5 });
    await finalizeAlbumPhotoFromRaw({ ...base, declaredPoint: { lat: -38.1, lng: -57.6 } });
    expect(photoCreate.mock.calls[0][0].data).toMatchObject({ geoLat: -38.0, geoLng: -57.5, geoSource: "EXIF_GPS" });
  });
  it("álbum de agencia: una repetida no crea foto y borra el raw", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue({ id: 7, previewUrl: "p7.jpg", originalKey: "o7.jpg" });
    const r = await finalizeAlbumPhotoFromRaw(base);
    expect(r).toEqual({ photo: { id: 7, previewUrl: "p7.jpg", originalKey: "o7.jpg" }, duplicate: true });
    expect(photoCreate).not.toHaveBeenCalled();
    expect(processPhoto).not.toHaveBeenCalled();
    expect(deleteFromR2).toHaveBeenCalledWith(base.key);
    const where = photoFindFirst.mock.calls[0][0].where;
    expect(where).toEqual({
      albumId: 5,
      isRemoved: false,
      OR: [
        { contentSha256: "h".repeat(64) },
        { cameraSerial: "S9", cameraImageNumber: 1, capturedAt: new Date("2027-01-10T15:00:00Z") },
      ],
    });
  });
  it("sin serial o sin número sólo compara la huella", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue(null);
    extractPhotoFacts.mockResolvedValue({ ...facts, cameraSerial: null });
    await finalizeAlbumPhotoFromRaw(base);
    expect(photoFindFirst.mock.calls[0][0].where.OR).toEqual([{ contentSha256: "h".repeat(64) }]);
  });
});

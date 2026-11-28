import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  detections: vi.fn(),
  items: vi.fn(),
  added: vi.fn(),
  createMany: vi.fn(),
  faceUpdate: vi.fn(),
  faces: vi.fn(),
  readiness: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    faceDetection: { findMany: (...a: unknown[]) => m.detections(...a) },
    orderItem: { findMany: (...a: unknown[]) => m.items(...a) },
    orderAddedPhoto: {
      findMany: (...a: unknown[]) => m.added(...a),
      createMany: (...a: unknown[]) => m.createMany(...a),
    },
    growingPackFace: {
      update: (...a: unknown[]) => m.faceUpdate(...a),
      findMany: (...a: unknown[]) => m.faces(...a),
    },
  },
}));
vi.mock("@/lib/faces/rekognition", () => ({ searchFacesByFaceId: vi.fn() }));
vi.mock("@/lib/analysis/album-analysis-readiness", () => ({
  getAlbumsReadiness: (...a: unknown[]) => m.readiness(...a),
}));
vi.mock("./notify-growing-pack-new-photos", () => ({
  notifyGrowingPackNewPhotos: (...a: unknown[]) => m.notify(...a),
}));

import { runGrowingPackSync, syncGrowingPackFace } from "./sync-growing-pack-photos";

const face = { id: 1, albumId: 10, orderId: 500, faceId: "buyer-face" };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.items.mockResolvedValue([{ photoId: 100 }]);
  m.added.mockResolvedValue([{ photoId: 101 }]);
  m.faceUpdate.mockResolvedValue({});
  m.createMany.mockResolvedValue({ count: 0 });
});

describe("syncGrowingPackFace", () => {
  it("suma sólo las fotos nuevas del álbum, con el umbral exigente", async () => {
    const search = vi.fn().mockResolvedValue([
      { rekognitionFaceId: "f-100", similarity: 99 },
      { rekognitionFaceId: "f-101", similarity: 98 },
      { rekognitionFaceId: "f-102", similarity: 95 },
    ]);
    m.detections.mockResolvedValue([
      { photoId: 100, rekognitionFaceId: "f-100" },
      { photoId: 101, rekognitionFaceId: "f-101" },
      { photoId: 102, rekognitionFaceId: "f-102" },
    ]);

    const added = await syncGrowingPackFace(face, search);

    expect(added).toBe(1);
    expect(search).toHaveBeenCalledWith("buyer-face", { maxFaces: 4096, faceMatchThreshold: 90 });
    expect(m.detections.mock.calls[0]![0].where.photo).toEqual({ albumId: 10, isRemoved: false });
    expect(m.createMany.mock.calls[0]![0]).toEqual({
      data: [{ orderId: 500, photoId: 102, similarity: 95 }],
      skipDuplicates: true,
    });
    expect(m.faceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { lastSyncedAt: expect.any(Date) } })
    );
  });

  it("sin coincidencias no consulta fotos ni agrega nada, pero anota la búsqueda", async () => {
    const added = await syncGrowingPackFace(face, vi.fn().mockResolvedValue([]));
    expect(added).toBe(0);
    expect(m.detections).not.toHaveBeenCalled();
    expect(m.createMany).not.toHaveBeenCalled();
    expect(m.faceUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("runGrowingPackSync", () => {
  it("espera a que el álbum termine de analizarse", async () => {
    m.faces.mockResolvedValue([{ ...face, lastSyncedAt: null }]);
    m.readiness.mockResolvedValue(new Map([[10, { ready: false, lastPhotoAt: new Date() }]]));
    const r = await runGrowingPackSync();
    expect(r).toMatchObject({ candidates: 1, synced: 0 });
  });

  it("sólo busca caras de pedidos pagados y activos", async () => {
    m.faces.mockResolvedValue([]);
    await runGrowingPackSync();
    expect(m.faces.mock.calls[0]![0].where).toMatchObject({
      orderId: { not: null },
      endedAt: null,
      biometricDeletedAt: null,
      order: { status: "PAID" },
    });
  });
});

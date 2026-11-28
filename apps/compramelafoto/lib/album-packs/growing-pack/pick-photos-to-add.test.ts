import { describe, expect, it } from "vitest";
import { pickPhotosToAdd, shouldSyncGrowingFace } from "./pick-photos-to-add";

describe("pickPhotosToAdd", () => {
  it("saca las fotos que el pedido ya tiene", () => {
    expect(
      pickPhotosToAdd(
        [
          { photoId: 1, similarity: 95 },
          { photoId: 2, similarity: 93 },
        ],
        new Set([1])
      )
    ).toEqual([{ photoId: 2, similarity: 93 }]);
  });
  it("una foto con dos caras parecidas se suma una sola vez, con el mayor parecido", () => {
    expect(
      pickPhotosToAdd(
        [
          { photoId: 7, similarity: 91 },
          { photoId: 7, similarity: 97 },
        ],
        new Set()
      )
    ).toEqual([{ photoId: 7, similarity: 97 }]);
  });
  it("ignora ids inválidos", () => {
    expect(pickPhotosToAdd([{ photoId: 0, similarity: 99 }], new Set())).toEqual([]);
  });
});

describe("shouldSyncGrowingFace", () => {
  const t = (iso: string) => new Date(iso);
  it("no busca mientras el álbum se sigue analizando", () => {
    expect(shouldSyncGrowingFace({ albumReady: false, lastPhotoAt: t("2026-11-27T10:00Z"), lastSyncedAt: null })).toBe(false);
  });
  it("la primera vez busca siempre (fotos subidas entre la búsqueda y el pago)", () => {
    expect(shouldSyncGrowingFace({ albumReady: true, lastPhotoAt: null, lastSyncedAt: null })).toBe(true);
  });
  it("busca de nuevo sólo si llegaron fotos después de la última búsqueda", () => {
    const synced = t("2026-11-27T12:00Z");
    expect(shouldSyncGrowingFace({ albumReady: true, lastPhotoAt: t("2026-11-27T11:00Z"), lastSyncedAt: synced })).toBe(false);
    expect(shouldSyncGrowingFace({ albumReady: true, lastPhotoAt: t("2026-11-28T09:00Z"), lastSyncedAt: synced })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  decideAlbumSocialGeneration,
  MAX_SOCIAL_PHOTOS,
  MIN_SOCIAL_PHOTOS,
  normalizeSelectedPhotoIds,
} from "./album-social-consent";

const base = {
  consentGiven: true,
  selectedPhotoIds: [1, 2, 3],
  photographerHandle: "fotografo",
  albumIsReady: true,
  alreadyGenerated: false,
};

describe("decideAlbumSocialGeneration", () => {
  it("genera cuando hay permiso, fotos y el álbum está analizado", () => {
    expect(decideAlbumSocialGeneration(base)).toEqual({ generate: true });
  });

  it("no genera sin permiso, aunque estén todas las fotos elegidas", () => {
    expect(decideAlbumSocialGeneration({ ...base, consentGiven: false })).toEqual({
      generate: false,
      reason: "NO_CONSENT",
    });
  });

  it("no genera con menos de tres fotos", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, selectedPhotoIds: [1, 2] }),
    ).toEqual({ generate: false, reason: "TOO_FEW_PHOTOS" });
  });

  it("no genera con más de cuatro fotos", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, selectedPhotoIds: [1, 2, 3, 4, 5] }),
    ).toEqual({ generate: false, reason: "TOO_MANY_PHOTOS" });
  });

  it("no genera si el álbum todavía se está analizando", () => {
    expect(decideAlbumSocialGeneration({ ...base, albumIsReady: false })).toEqual({
      generate: false,
      reason: "ALBUM_NOT_READY",
    });
  });

  it("no genera dos veces el mismo álbum", () => {
    expect(decideAlbumSocialGeneration({ ...base, alreadyGenerated: true })).toEqual({
      generate: false,
      reason: "ALREADY_GENERATED",
    });
  });

  it("genera igual sin usuario de Instagram: no etiquetar no es motivo para no publicar", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, photographerHandle: null }),
    ).toEqual({ generate: true });
  });

  it("los límites son 3 y 4", () => {
    expect(MIN_SOCIAL_PHOTOS).toBe(3);
    expect(MAX_SOCIAL_PHOTOS).toBe(4);
  });

  it("la guarda del permiso va primero: sin permiso y sin fotos, el motivo es NO_CONSENT", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, consentGiven: false, selectedPhotoIds: [] }),
    ).toEqual({ generate: false, reason: "NO_CONSENT" });
  });

  it("una misma foto repetida no cuenta como varias: no llega al mínimo", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, selectedPhotoIds: [5, 5, 5] }),
    ).toEqual({ generate: false, reason: "TOO_FEW_PHOTOS" });
  });

  it("con fotos repetidas pero al menos tres distintas, genera igual", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, selectedPhotoIds: [1, 2, 2, 3] }),
    ).toEqual({ generate: true });
  });
});

describe("normalizeSelectedPhotoIds", () => {
  it("saca duplicados preservando el orden de la primera aparición", () => {
    expect(normalizeSelectedPhotoIds([1, 2, 2, 3])).toEqual([1, 2, 3]);
  });

  it("descarta lo que no sea un número de verdad: strings, null, etc.", () => {
    expect(normalizeSelectedPhotoIds(["1", 2, null, 3, 3])).toEqual([2, 3]);
  });

  it("algo que no sea un array da lista vacía", () => {
    expect(normalizeSelectedPhotoIds(undefined)).toEqual([]);
    expect(normalizeSelectedPhotoIds("no es un array")).toEqual([]);
  });
});

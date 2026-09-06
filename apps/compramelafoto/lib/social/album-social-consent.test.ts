import { describe, expect, it } from "vitest";
import {
  decideAlbumSocialGeneration,
  MAX_SOCIAL_PHOTOS,
  MIN_SOCIAL_PHOTOS,
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
});

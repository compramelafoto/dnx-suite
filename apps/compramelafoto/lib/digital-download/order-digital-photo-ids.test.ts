import { describe, expect, it } from "vitest";
import {
  isGrowingPackZipRefresh,
  mergeOrderDigitalPhotoIds,
  zipJobCoversPhotos,
} from "./order-digital-photo-ids";

describe("mergeOrderDigitalPhotoIds", () => {
  it("suma las fotos agregadas después de pagar, sin repetir", () => {
    expect(mergeOrderDigitalPhotoIds([3, 1, 3], [1, 9, 7])).toEqual([3, 1, 9, 7]);
  });
  it("ignora valores vacíos o inválidos", () => {
    expect(mergeOrderDigitalPhotoIds([null, 2, undefined], [0, -1])).toEqual([2]);
  });
});

describe("zipJobCoversPhotos", () => {
  it("un ZIP con todas las fotos se reutiliza", () => {
    expect(zipJobCoversPhotos([1, 2, 3], [3, 1])).toBe(true);
  });
  it("si se sumó una foto, hay que rearmarlo", () => {
    expect(zipJobCoversPhotos([1, 2], [1, 2, 5])).toBe(false);
  });
  it("un ZIP sin lista de fotos no cubre las sumadas", () => {
    expect(zipJobCoversPhotos([], [1])).toBe(false);
  });
});

describe("isGrowingPackZipRefresh", () => {
  it("reconoce el ZIP rearmado por fotos sumadas", () => {
    expect(isGrowingPackZipRefresh({ growingPackRefresh: true })).toBe(true);
    expect(isGrowingPackZipRefresh(null)).toBe(false);
    expect(isGrowingPackZipRefresh({ other: 1 })).toBe(false);
  });
});

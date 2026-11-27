import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/gear/exif", async (orig) => ({
  ...(await orig<typeof import("@repo/gear/exif")>()),
  extractExifMetadata: vi.fn(),
}));

import { extractExifMetadata } from "@repo/gear/exif";
import { computeUsageSeal, proofPhotoMatches } from "./sellos";

describe("computeUsageSeal", () => {
  it("sello de uso con el avistaje más viejo del vendedor y suma de fotos", () => {
    const r = computeUsageSeal(
      [
        { photographerId: 7, firstSeenAt: new Date("2025-03-10"), photosCount: 40 },
        { photographerId: 7, firstSeenAt: new Date("2024-11-02"), photosCount: 12 },
      ],
      7,
    );
    expect(r).toEqual({
      seal: "USAGE_VERIFIED",
      since: new Date("2024-11-02"),
      photos: 52,
      otherOwner: false,
    });
  });
  it("serie vista sólo bajo otro usuario: sin sello y marca otherOwner", () => {
    const r = computeUsageSeal(
      [{ photographerId: 9, firstSeenAt: new Date("2025-03-10"), photosCount: 4 }],
      7,
    );
    expect(r).toEqual({ seal: "NONE", since: null, photos: null, otherOwner: true });
  });
  it("sin avistajes", () => {
    expect(computeUsageSeal([], 7)).toEqual({
      seal: "NONE",
      since: null,
      photos: null,
      otherOwner: false,
    });
  });
  it("vendedor y otro dueño a la vez", () => {
    const r = computeUsageSeal(
      [
        { photographerId: 7, firstSeenAt: new Date("2025-01-01"), photosCount: 3 },
        { photographerId: 9, firstSeenAt: new Date("2024-01-01"), photosCount: 5 },
        { photographerId: null, firstSeenAt: new Date("2023-01-01"), photosCount: 8 },
      ],
      7,
    );
    expect(r.seal).toBe("USAGE_VERIFIED");
    expect(r.photos).toBe(3);
    expect(r.otherOwner).toBe(true);
  });
});

describe("proofPhotoMatches", () => {
  const meta = (serialNumber: string | null, lens?: string) => ({
    make: "Canon",
    model: "R6",
    serialNumber,
    lensMake: null,
    lensModel: null,
    focalLength: null,
    exposureTime: null,
    aperture: null,
    iso: null,
    takenAt: null,
    gpsLat: null,
    gpsLng: null,
    shutterCount: null,
    rawExifSummary: lens ? { LensSerialNumber: lens } : {},
  });
  it("coincide con la serie del cuerpo o del lente", async () => {
    vi.mocked(extractExifMetadata).mockResolvedValue(meta("0123-45", "98 76 54"));
    expect(await proofPhotoMatches(Buffer.from("x"), "12345")).toBe(true);
    expect(await proofPhotoMatches(Buffer.from("x"), "987654")).toBe(true);
    expect(await proofPhotoMatches(Buffer.from("x"), "555555")).toBe(false);
  });
  it("sin metadatos o sin series, falso", async () => {
    vi.mocked(extractExifMetadata).mockResolvedValue(null);
    expect(await proofPhotoMatches(Buffer.from("x"), "12345")).toBe(false);
    vi.mocked(extractExifMetadata).mockResolvedValue(meta(null));
    expect(await proofPhotoMatches(Buffer.from("x"), "12345")).toBe(false);
  });
});

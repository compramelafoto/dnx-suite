import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractGearSerials } from "./exif";
import type { ExtractedExifMetadata } from "./exif";

function meta(over: Partial<ExtractedExifMetadata>): ExtractedExifMetadata {
  return {
    make: null,
    model: null,
    serialNumber: null,
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
    rawExifSummary: {},
    ...over,
  };
}

describe("extractGearSerials", () => {
  it("normaliza la serie del cuerpo y la del lente (sin ceros a la izquierda)", () => {
    const r = extractGearSerials(
      meta({
        make: "Canon",
        model: "EOS R6",
        serialNumber: "0123-45",
        rawExifSummary: { LensSerialNumber: " 98 76 54 " },
      })
    );
    assert.deepEqual(r, { make: "Canon", model: "EOS R6", bodySerial: "12345", lensSerial: "987654" });
  });

  it("sin series devuelve null en ambas", () => {
    const r = extractGearSerials(meta({ make: "Nikon", model: "Z6" }));
    assert.equal(r.bodySerial, null);
    assert.equal(r.lensSerial, null);
  });
});

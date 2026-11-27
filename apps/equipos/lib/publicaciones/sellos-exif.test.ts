import { describe, expect, it } from "vitest";
import { jpegConSeries } from "./jpeg-exif";
import { proofPhotoMatches } from "./sellos";

// Sin mocks: corre el lector EXIF real sobre un JPEG armado a mano.
describe("proofPhotoMatches con un JPEG real", () => {
  it("coincide con la serie del cuerpo (con ceros y guiones normalizados)", async () => {
    const jpeg = jpegConSeries({ body: "0123-45" });
    expect(await proofPhotoMatches(jpeg, "12345")).toBe(true);
  });
  it("coincide con la serie del lente", async () => {
    const jpeg = jpegConSeries({ body: "111111", lens: "98 76 54" });
    expect(await proofPhotoMatches(jpeg, "987654")).toBe(true);
  });
  it("otra serie: falso", async () => {
    const jpeg = jpegConSeries({ body: "111111", lens: "222222" });
    expect(await proofPhotoMatches(jpeg, "333333")).toBe(false);
  });
  it("JPEG sin series: falso", async () => {
    expect(await proofPhotoMatches(jpegConSeries({}), "12345")).toBe(false);
  });
});

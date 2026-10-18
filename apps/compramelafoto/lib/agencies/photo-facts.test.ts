import { beforeEach, describe, expect, it, vi } from "vitest";

const exifrParse = vi.fn();
vi.mock("exifr", () => ({ default: { parse: (...a: unknown[]) => exifrParse(...a) } }));

import {
  cameraFactsFromExif,
  extractPhotoFacts,
  imageNumberFromFilename,
  parseDeclaredPoint,
  parseImageNumber,
  resolvePhotoLocation,
  sha256Hex,
} from "./photo-facts";

beforeEach(() => exifrParse.mockReset());

describe("sha256Hex", () => {
  it("devuelve la huella en hexadecimal", () => {
    expect(sha256Hex(Buffer.from("hola"))).toBe("b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79");
  });
});

describe("parseImageNumber", () => {
  it("acepta números y textos de cámara", () => {
    expect(parseImageNumber(1234)).toBe(1234);
    expect(parseImageNumber("1234")).toBe(1234);
    expect(parseImageNumber("100-1234")).toBe(1001234);
  });
  it("rechaza lo que no sirve", () => {
    for (const bad of [0, -3, "abc", "", null, undefined, 1.5]) expect(parseImageNumber(bad)).toBe(null);
  });
});

describe("cameraFactsFromExif", () => {
  it("toma serial, número y GPS", () => {
    expect(
      cameraFactsFromExif({ BodySerialNumber: " 4021234 ", ImageNumber: 77, latitude: -38.0, longitude: -57.55 })
    ).toEqual({ cameraSerial: "4021234", cameraImageNumber: 77, exifLat: -38.0, exifLng: -57.55 });
  });
  it("cae a SerialNumber y FileNumber", () => {
    expect(cameraFactsFromExif({ SerialNumber: "X1", FileNumber: "100-0042" })).toMatchObject({
      cameraSerial: "X1",
      cameraImageNumber: 1000042,
    });
  });
  it("GPS (0,0) o fuera de rango no cuenta", () => {
    expect(cameraFactsFromExif({ latitude: 0, longitude: 0 })).toMatchObject({ exifLat: null, exifLng: null });
    expect(cameraFactsFromExif({ latitude: 200, longitude: 10 })).toMatchObject({ exifLat: null, exifLng: null });
  });
  it("sin EXIF devuelve todo null", () => {
    expect(cameraFactsFromExif(null)).toEqual({ cameraSerial: null, cameraImageNumber: null, exifLat: null, exifLng: null });
    expect(cameraFactsFromExif({ SerialNumber: "   " }).cameraSerial).toBe(null);
  });
});

describe("imageNumberFromFilename", () => {
  it("reconoce los nombres típicos", () => {
    expect(imageNumberFromFilename("DSC_1234.JPG")).toBe(1234);
    expect(imageNumberFromFilename("IMG_0042.jpg")).toBe(42);
    expect(imageNumberFromFilename("_MG_9876.JPG")).toBe(9876);
    expect(imageNumberFromFilename("DSCF5555.JPG")).toBe(5555);
  });
  it("otro formato: null", () => {
    expect(imageNumberFromFilename("foto final.jpg")).toBe(null);
    expect(imageNumberFromFilename(null)).toBe(null);
  });
});

describe("extractPhotoFacts", () => {
  it("combina EXIF y huella", async () => {
    exifrParse.mockResolvedValue({ SerialNumber: "S9", ImageNumber: 5, latitude: -38.01, longitude: -57.53 });
    const facts = await extractPhotoFacts(Buffer.from("hola"), "DSC_0001.JPG");
    expect(facts).toEqual({
      contentSha256: "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79",
      cameraSerial: "S9",
      cameraImageNumber: 5,
      exifLat: -38.01,
      exifLng: -57.53,
    });
    expect(exifrParse.mock.calls[0][1]).toMatchObject({ gps: true });
  });
  it("sin número en EXIF usa el del nombre de archivo", async () => {
    exifrParse.mockResolvedValue({ SerialNumber: "S9" });
    expect((await extractPhotoFacts(Buffer.from("x"), "DSC_0099.JPG")).cameraImageNumber).toBe(99);
  });
  it("si exifr falla, no lanza", async () => {
    exifrParse.mockRejectedValue(new Error("roto"));
    const facts = await extractPhotoFacts(Buffer.from("x"), null);
    expect(facts).toMatchObject({ cameraSerial: null, cameraImageNumber: null, exifLat: null, exifLng: null });
    expect(facts.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("parseDeclaredPoint y resolvePhotoLocation", () => {
  it("parsea puntos válidos e ignora los malos", () => {
    expect(parseDeclaredPoint(-38.0, -57.5)).toEqual({ lat: -38.0, lng: -57.5 });
    expect(parseDeclaredPoint("-38,0", "-57,5")).toEqual({ lat: -38.0, lng: -57.5 });
    for (const [a, b] of [["abc", 1], [200, 1], [-38, null], [0, 0], [undefined, undefined]]) {
      expect(parseDeclaredPoint(a, b)).toBe(null);
    }
  });
  it("manda el GPS; si no, el declarado; si no, nada", () => {
    const declared = { lat: -38.1, lng: -57.6 };
    expect(resolvePhotoLocation({ exifLat: -38.0, exifLng: -57.5 }, declared)).toEqual({ geoLat: -38.0, geoLng: -57.5, geoSource: "EXIF_GPS" });
    expect(resolvePhotoLocation({ exifLat: null, exifLng: null }, declared)).toEqual({ geoLat: -38.1, geoLng: -57.6, geoSource: "DECLARED" });
    expect(resolvePhotoLocation({ exifLat: null, exifLng: null }, null)).toBe(null);
  });
});

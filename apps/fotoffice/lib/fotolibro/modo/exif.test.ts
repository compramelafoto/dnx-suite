import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fechaDeToma } from "./exif";

const buf = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const base = () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#888" } });

describe("fecha de toma del EXIF", () => {
  it("lee DateTimeOriginal, sin cambiarle la hora", async () => {
    const jpg = await base().withExif({ IFD0: { Make: "Canon" }, IFD2: { DateTimeOriginal: "2026:10:12 21:33:05" } }).jpeg().toBuffer();
    expect(fechaDeToma(buf(jpg))).toBe("2026-10-12T21:33:05");
  });

  it("sin la original, usa la fecha del archivo de la cámara", async () => {
    const jpg = await base().withExif({ IFD0: { DateTime: "2025:01:02 03:04:05" } }).jpeg().toBuffer();
    expect(fechaDeToma(buf(jpg))).toBe("2025-01-02T03:04:05");
  });

  it("sin EXIF, o si no es JPG, no inventa nada", async () => {
    expect(fechaDeToma(buf(await base().jpeg().toBuffer()))).toBeNull();
    expect(fechaDeToma(buf(await base().png().toBuffer()))).toBeNull();
    expect(fechaDeToma(new ArrayBuffer(2))).toBeNull();
  });
});

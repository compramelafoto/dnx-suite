import { describe, expect, it } from "vitest";
import { readImageDimensionsFromBytes } from "./dimensions";

/** PNG mínimo válido: firma + IHDR con las medidas en big-endian. */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  b.set([width >> 24, (width >> 16) & 255, (width >> 8) & 255, width & 255], 16);
  b.set([height >> 24, (height >> 16) & 255, (height >> 8) & 255, height & 255], 20);
  return b;
}

/** JPEG con un segmento de relleno antes del SOF, como los que escribe cualquier cámara. */
function jpeg(width: number, height: number, conExif = true): Uint8Array {
  const partes: number[] = [0xff, 0xd8];
  if (conExif) {
    // APP1 de 100 bytes: lo que hay que saltear para llegar al SOF.
    partes.push(0xff, 0xe1, 0x00, 0x64, ...new Array(98).fill(0));
  }
  partes.push(
    0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 255,
    width >> 8, width & 255,
    0x03,
  );
  return new Uint8Array(partes);
}

function webpSimple(width: number, height: number): Uint8Array {
  const b = new Uint8Array(32);
  const txt = (s: string, i: number) => b.set([...s].map((c) => c.charCodeAt(0)), i);
  txt("RIFF", 0);
  txt("WEBP", 8);
  txt("VP8 ", 12);
  b.set([width & 255, (width >> 8) & 0x3f], 26);
  b.set([height & 255, (height >> 8) & 0x3f], 28);
  return b;
}

describe("readImageDimensionsFromBytes", () => {
  it("lee un PNG", () => {
    expect(readImageDimensionsFromBytes(png(2400, 1600))).toEqual({ width: 2400, height: 1600 });
  });

  it("lee un JPEG salteando el EXIF, que es el caso real de una cámara", () => {
    expect(readImageDimensionsFromBytes(jpeg(1024, 1536))).toEqual({ width: 1024, height: 1536 });
  });

  it("lee un JPEG sin metadatos", () => {
    expect(readImageDimensionsFromBytes(jpeg(800, 600, false))).toEqual({ width: 800, height: 600 });
  });

  it("lee un WebP con pérdida", () => {
    expect(readImageDimensionsFromBytes(webpSimple(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("aguanta una panorámica y una vertical, que es para lo que sirve", () => {
    expect(readImageDimensionsFromBytes(jpeg(4000, 1200))).toEqual({ width: 4000, height: 1200 });
    expect(readImageDimensionsFromBytes(png(1200, 4000))).toEqual({ width: 1200, height: 4000 });
  });

  it("devuelve null si no es ninguno de los tres formatos", () => {
    expect(readImageDimensionsFromBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });

  it("devuelve null con bytes de más o de menos, en vez de inventar un número", () => {
    expect(readImageDimensionsFromBytes(new Uint8Array(0))).toBeNull();
    expect(readImageDimensionsFromBytes(new Uint8Array([0x89, 0x50]))).toBeNull();
    // Firma de JPEG pero sin ningún SOF: no hay de dónde sacar las medidas.
    expect(readImageDimensionsFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]))).toBeNull();
  });
});

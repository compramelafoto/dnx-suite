import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import exifr from "exifr";

import {
  extractExifSegment,
  resetExifOrientation,
  transplantExif,
} from "./jpeg-exif";

async function fotoDeCamara(): Promise<Buffer> {
  return sharp({
    create: { width: 40, height: 20, channels: 3, background: "#808080" },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Make: "Canon", Model: "EOS R6" },
        IFD2: { DateTimeOriginal: "2026:11:20 18:30:00", BodySerialNumber: "123456" },
      },
    })
    .toBuffer();
}

async function jpegSinMetadatos(): Promise<Buffer> {
  // Como el que genera el canvas del navegador: sin EXIF.
  return sharp({
    create: { width: 20, height: 40, channels: 3, background: "#404040" },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

describe("la foto reducida conserva los datos de la cámara", () => {
  it("encuentra el EXIF de una foto de cámara", async () => {
    const seg = extractExifSegment(new Uint8Array(await fotoDeCamara()));
    assert.ok(seg, "no encontró el EXIF");
    assert.equal(seg[0], 0xff);
    assert.equal(seg[1], 0xe1);
  });

  it("un JPEG sin metadatos no tiene EXIF", async () => {
    assert.equal(extractExifSegment(new Uint8Array(await jpegSinMetadatos())), null);
  });

  it("no es un JPEG: no rompe", () => {
    assert.equal(extractExifSegment(new Uint8Array([1, 2, 3, 4, 5, 6])), null);
  });

  it("trasplanta fecha, cámara y número de serie", async () => {
    const out = Buffer.from(
      transplantExif(
        new Uint8Array(await fotoDeCamara()),
        new Uint8Array(await jpegSinMetadatos())
      )
    );
    const exif = await exifr.parse(out, { translateValues: false, reviveValues: false });
    assert.equal(exif.Make, "Canon");
    assert.equal(exif.Model, "EOS R6");
    assert.equal(exif.DateTimeOriginal, "2026:11:20 18:30:00");
    assert.equal(exif.SerialNumber, "123456");
  });

  it("deja la orientación en normal para no girar la foto dos veces", async () => {
    const out = Buffer.from(
      transplantExif(
        new Uint8Array(await fotoDeCamara()),
        new Uint8Array(await jpegSinMetadatos())
      )
    );
    const meta = await sharp(out).metadata();
    assert.equal(meta.orientation, 1);
    // La imagen sigue siendo legible y con las medidas del re-codificado.
    assert.equal(meta.width, 20);
    assert.equal(meta.height, 40);
  });

  it("resetExifOrientation no toca el original", async () => {
    const seg = extractExifSegment(new Uint8Array(await fotoDeCamara()))!;
    const antes = seg.slice();
    resetExifOrientation(seg);
    assert.deepEqual(seg, antes);
  });

  it("si el original no tiene EXIF, devuelve el re-codificado tal cual", async () => {
    const reenc = new Uint8Array(await jpegSinMetadatos());
    assert.equal(transplantExif(new Uint8Array(await jpegSinMetadatos()), reenc), reenc);
  });
});

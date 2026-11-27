/**
 * Ayuda de pruebas: arma un JPEG mínimo con un segmento EXIF (APP1) que trae sólo las series
 * del cuerpo (0xA431) y del lente (0xA435) en el IFD Exif. Little endian.
 */
export function jpegConSeries(opts: { body?: string; lens?: string }): Buffer {
  const entries: Array<{ tag: number; text: string }> = [];
  if (opts.body) entries.push({ tag: 0xa431, text: opts.body });
  if (opts.lens) entries.push({ tag: 0xa435, text: opts.lens });

  // TIFF: header (8) + IFD0 (2 + 12 + 4) + ExifIFD (2 + 12n + 4) + datos
  const ifd0Off = 8;
  const exifOff = ifd0Off + 2 + 12 + 4;
  const dataStart = exifOff + 2 + 12 * entries.length + 4;
  const tiff = Buffer.alloc(dataStart);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifd0Off, 4);
  // IFD0: una entrada, puntero al IFD Exif (0x8769)
  tiff.writeUInt16LE(1, ifd0Off);
  tiff.writeUInt16LE(0x8769, ifd0Off + 2);
  tiff.writeUInt16LE(4, ifd0Off + 4); // LONG
  tiff.writeUInt32LE(1, ifd0Off + 6);
  tiff.writeUInt32LE(exifOff, ifd0Off + 10);
  tiff.writeUInt32LE(0, ifd0Off + 14);
  // IFD Exif
  tiff.writeUInt16LE(entries.length, exifOff);
  const datos: Buffer[] = [];
  let offset = dataStart;
  entries.forEach((e, i) => {
    const bytes = Buffer.from(e.text + "\0", "ascii");
    const p = exifOff + 2 + 12 * i;
    tiff.writeUInt16LE(e.tag, p);
    tiff.writeUInt16LE(2, p + 2); // ASCII
    tiff.writeUInt32LE(bytes.length, p + 4);
    tiff.writeUInt32LE(offset, p + 8);
    datos.push(bytes);
    offset += bytes.length;
  });
  tiff.writeUInt32LE(0, exifOff + 2 + 12 * entries.length);

  const payload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff, ...datos]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, payload, Buffer.from([0xff, 0xd9])]);
}

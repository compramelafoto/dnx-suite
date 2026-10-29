/**
 * La fecha y hora en que se sacó una foto, leída del EXIF de un JPG.
 *
 * Es un lector mínimo a propósito (sólo `DateTimeOriginal`, y si no está, `DateTime`): una
 * librería entera de EXIF para un dato no se justifica. Alcanza con los primeros 128 KB del
 * archivo, que es donde va el EXIF.
 *
 * La hora se devuelve tal como la guardó la cámara, sin zona ("2026-10-12T21:33:05"): sirve para
 * ordenar las fotos de un mismo evento, que es para lo que se usa. Convertirla a otra zona la
 * correría (ver `feedback_exifr_devuelve_la_hora_en_la_zona_del_runtime`).
 */

export const BYTES_EXIF = 128 * 1024;

const TAG_EXIF_IFD = 0x8769;
const TAG_FECHA_ORIGINAL = 0x9003;
const TAG_FECHA = 0x0132;

export function fechaDeToma(buffer: ArrayBuffer): string | null {
  const v = new DataView(buffer);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // no es JPG
  let p = 2;
  while (p + 4 <= v.byteLength) {
    if (v.getUint8(p) !== 0xff) return null;
    const marca = v.getUint8(p + 1);
    const largo = v.getUint16(p + 2);
    if (marca === 0xda || marca === 0xd9) return null; // empezó la imagen: no hay EXIF
    if (marca === 0xe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966) {
      return leerTiff(v, p + 10);
    }
    p += 2 + largo;
  }
  return null;
}

function leerTiff(v: DataView, base: number): string | null {
  if (base + 8 > v.byteLength) return null;
  const orden = v.getUint16(base);
  const le = orden === 0x4949;
  if (!le && orden !== 0x4d4d) return null;
  const u16 = (o: number) => v.getUint16(base + o, le);
  const u32 = (o: number) => v.getUint32(base + o, le);

  /** Busca una etiqueta en un directorio; devuelve el desplazamiento de su valor. */
  const buscar = (ifd: number, tag: number): { tipo: number; cant: number; valor: number } | null => {
    if (base + ifd + 2 > v.byteLength) return null;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (base + e + 12 > v.byteLength) return null;
      if (u16(e) === tag) return { tipo: u16(e + 2), cant: u32(e + 4), valor: e + 8 };
    }
    return null;
  };

  const texto = (ent: { tipo: number; cant: number; valor: number } | null): string | null => {
    if (!ent || ent.tipo !== 2 || ent.cant < 19) return null;
    const o = ent.cant > 4 ? u32(ent.valor) : ent.valor;
    if (base + o + 19 > v.byteLength) return null;
    let s = "";
    for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(base + o + i));
    return normalizar(s);
  };

  const ifd0 = u32(4);
  const exif = buscar(ifd0, TAG_EXIF_IFD);
  if (exif) {
    const f = texto(buscar(u32(exif.valor), TAG_FECHA_ORIGINAL));
    if (f) return f;
  }
  return texto(buscar(ifd0, TAG_FECHA));
}

/** "2026:10:12 21:33:05" → "2026-10-12T21:33:05". Descarta fechas vacías ("0000:00:00 …"). */
function normalizar(s: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

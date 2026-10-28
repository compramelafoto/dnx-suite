/**
 * Un ZIP sin comprimir ("stored"), armado a mano para el navegador.
 *
 * Existe para no sumar `jszip` a FOTOFFICE: una dependencia nueva rehace el `pnpm-lock` de todo
 * el monorepo. Lo que se empaqueta son JPEG, que comprimidos no achican, así que alcanza con
 * guardarlos tal cual. Formato: PKWARE APPNOTE 6.3, sin ZIP64 (hasta 4 GB y 65.535 archivos).
 */

export type ArchivoZip = { nombre: string; datos: Uint8Array };

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Bit 11: el nombre va en UTF-8 (las "ñ" y los acentos se leen bien en cualquier sistema). */
const UTF8 = 0x0800;

export function armarZip(archivos: ArchivoZip[]): Uint8Array<ArrayBuffer> {
  const cod = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const a of archivos) {
    const nombre = cod.encode(a.nombre);
    const crc = crc32(a.datos);
    const tam = a.datos.length;

    const local = new Uint8Array(30 + nombre.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, UTF8, true);
    l.setUint16(8, 0, true); // sin comprimir
    l.setUint32(14, crc, true);
    l.setUint32(18, tam, true);
    l.setUint32(22, tam, true);
    l.setUint16(26, nombre.length, true);
    local.set(nombre, 30);

    const central = new Uint8Array(46 + nombre.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, UTF8, true);
    c.setUint16(10, 0, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tam, true);
    c.setUint32(24, tam, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);

    locales.push(local, a.datos);
    centrales.push(central);
    desplazamiento += local.length + tam;
  }

  const tamCentral = centrales.reduce((s, x) => s + x.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, archivos.length, true);
  f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, fin];
  const salida = new Uint8Array(partes.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

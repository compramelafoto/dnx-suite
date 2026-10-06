/**
 * Un ZIP mínimo, sin comprimir, que se arma en el navegador.
 *
 * Las fotos ya vienen en JPEG: comprimirlas otra vez no ahorra nada y sólo
 * gasta tiempo. Por eso alcanza con el método "store" del formato, que son
 * unas pocas cabeceras y un CRC por archivo. Se arma acá y no en el servidor
 * porque una función de Vercel no puede responder más de 4,5 MB, y un ZIP con
 * varias consignas lo pasa enseguida. Tampoco suma una dependencia al
 * monorepo: el lockfile es de todas las apps.
 */

export type ArchivoDelZip = { nombre: string; datos: Uint8Array };

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

export function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < datos.length; i++) {
    crc = TABLA_CRC[(crc ^ datos[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en el formato de MS-DOS que piden las cabeceras del ZIP. */
function fechaDos(fecha: Date): { hora: number; dia: number } {
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2),
    dia: ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  };
}

export function armarZip(archivos: ArchivoDelZip[], fecha = new Date()): Uint8Array {
  const codificador = new TextEncoder();
  const { hora, dia } = fechaDos(fecha);
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const archivo of archivos) {
    const nombre = codificador.encode(archivo.nombre);
    const crc = crc32(archivo.datos);
    const tam = archivo.datos.length;

    const local = new Uint8Array(30 + nombre.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versión necesaria
    l.setUint16(6, 0x0800, true); // nombres en UTF-8: tildes y eñes
    l.setUint16(8, 0, true); // sin compresión
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, tam, true);
    l.setUint32(22, tam, true);
    l.setUint16(26, nombre.length, true);
    l.setUint16(28, 0, true);
    local.set(nombre, 30);

    const central = new Uint8Array(46 + nombre.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tam, true);
    c.setUint32(24, tam, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);

    locales.push(local, archivo.datos);
    centrales.push(central);
    desplazamiento += local.length + tam;
  }

  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, archivos.length, true);
  f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, fin];
  const salida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of partes) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

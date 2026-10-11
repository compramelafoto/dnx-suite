/**
 * Escritor de ZIP propio (etapa 7, Entrega B). Sin dependencias, sin compresión (método *store*: las fotos y los
 * videos ya vienen comprimidos) y pensado para ARMAR EL ARCHIVO EN FLUJO, sin tenerlo entero en memoria:
 *
 * - cada archivo lleva un encabezado local con el bit 3 (los datos no traen CRC ni tamaño por adelantado) y, después
 *   de los datos, un *data descriptor* con el CRC32 y los tamaños; así el CRC se calcula mientras el archivo pasa;
 * - nombres en UTF-8 (bit 11 de las banderas);
 * - el directorio central y el registro final van al terminar;
 * - SIN ZIP64: cada parte pesa como mucho 4 GB menos un margen y tiene como mucho 65.535 archivos. Si algo se pasa
 *   de esos límites, el escritor lanza en vez de producir un ZIP que los programas no abren.
 *
 * Módulo PURO (sólo `node:zlib`): sirve igual en el cron y en las pruebas.
 */
import { crc32 as crc32Nativo } from "node:zlib";

export const MAX_ARCHIVOS_POR_ZIP = 65_534;
/** Tope de cualquier tamaño o desplazamiento sin ZIP64. */
export const MAX_ZIP32 = 0xffff_ffff;

// --- CRC32 -------------------------------------------------------------------------------------------------

let tabla: Uint32Array | null = null;
function tablaCrc(): Uint32Array {
  if (tabla) return tabla;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  tabla = t;
  return t;
}

/** CRC32 propio (tabla), por si el Node en uso no trae `zlib.crc32`. `previo` permite seguir un cálculo en trozos. */
export function crc32Tabla(datos: Uint8Array, previo = 0): number {
  const t = tablaCrc();
  let c = (previo ^ 0xffff_ffff) >>> 0;
  for (let i = 0; i < datos.length; i++) c = t[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffff_ffff) >>> 0;
}

/** CRC32 en trozos: `zlib.crc32` si existe (Node 22+) y la tabla propia si no. */
export function crc32(datos: Uint8Array, previo = 0): number {
  return typeof crc32Nativo === "function" ? crc32Nativo(datos, previo) >>> 0 : crc32Tabla(datos, previo);
}

// --- Nombres -----------------------------------------------------------------------------------------------

/** Nombre seguro para dentro del ZIP: sin carpetas ni caracteres de control, con un largo razonable. Nunca vacío. */
export function nombreDentroDelZip(nombre: string, alternativo = "archivo"): string {
  const limpio = String(nombre ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, 150);
  return limpio || alternativo;
}

/** Nombres sin repetirse (sin distinguir mayúsculas): el segundo "IMG_1.jpg" pasa a "IMG_1 (2).jpg". Conserva el orden. */
export function nombresUnicos(nombres: readonly string[]): string[] {
  const usados = new Set<string>();
  // Próximo número a probar por nombre base: evita recorrer desde (2) cada vez cuando hay miles de repetidos.
  const siguiente = new Map<string, number>();
  return nombres.map((original) => {
    const base = nombreDentroDelZip(original);
    let candidato = base;
    if (usados.has(candidato.toLowerCase())) {
      const punto = base.lastIndexOf(".");
      const cuerpo = punto > 0 ? base.slice(0, punto) : base;
      const ext = punto > 0 ? base.slice(punto) : "";
      let n = siguiente.get(base.toLowerCase()) ?? 2;
      candidato = `${cuerpo} (${n})${ext}`;
      while (usados.has(candidato.toLowerCase())) candidato = `${cuerpo} (${++n})${ext}`;
      siguiente.set(base.toLowerCase(), n + 1);
    }
    usados.add(candidato.toLowerCase());
    return candidato;
  });
}

// --- Estructuras -------------------------------------------------------------------------------------------

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_DESCRIPTOR = 0x08074b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FIN = 0x06054b50;
/** Bit 3 (tamaños y CRC después de los datos) + bit 11 (nombres en UTF-8). */
const BANDERAS = 0x0808;
const VERSION = 20;

/** Fecha y hora en formato MS-DOS (hora de Argentina; no se guardan zonas). Antes de 1980 se trunca a 1980. */
const FORMATO_DOS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
});

export function fechaDos(fecha: Date): { hora: number; fecha: number } {
  const partes = FORMATO_DOS.formatToParts(fecha);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  const anio = Math.min(Math.max(v("year"), 1980), 2107);
  return { hora: (v("hour") << 11) | (v("minute") << 5) | (v("second") >> 1), fecha: ((anio - 1980) << 9) | (v("month") << 5) | v("day") };
}

type Entrada = { nombre: Buffer; hora: number; fecha: number; crc: number; tamano: number; desplazamiento: number };

/**
 * Arma un ZIP pieza por pieza. Uso: `encabezado(nombre, fecha)` → bytes del encabezado; los datos del archivo van
 * tal cual (el que arma el flujo calcula el CRC y cuenta los bytes); `cierre(crc, tamano)` → data descriptor;
 * al final `directorioCentral()`. `posicion` es siempre la cantidad de bytes emitidos hasta ahora.
 */
export class ConstructorZip {
  private entradas: Entrada[] = [];
  private actual: Entrada | null = null;
  /** Bytes emitidos hasta ahora (la posición del próximo byte del ZIP). */
  posicion = 0;

  get archivos(): number {
    return this.entradas.length;
  }

  encabezado(nombre: string, fecha: Date): Buffer {
    if (this.actual) throw new Error("ZIP: falta cerrar el archivo anterior");
    if (this.entradas.length >= MAX_ARCHIVOS_POR_ZIP) throw new Error("ZIP: demasiados archivos para una sola parte");
    const n = Buffer.from(nombre, "utf8");
    if (n.length === 0 || n.length > 0xffff) throw new Error("ZIP: nombre de archivo inválido");
    if (this.posicion > MAX_ZIP32) throw new Error("ZIP: la parte se pasó de 4 GB");
    const { hora, fecha: dia } = fechaDos(fecha);
    const h = Buffer.alloc(30 + n.length);
    h.writeUInt32LE(FIRMA_LOCAL, 0);
    h.writeUInt16LE(VERSION, 4);
    h.writeUInt16LE(BANDERAS, 6);
    h.writeUInt16LE(0, 8); // store
    h.writeUInt16LE(hora, 10);
    h.writeUInt16LE(dia, 12);
    // CRC y tamaños en cero: van en el data descriptor.
    h.writeUInt16LE(n.length, 26);
    h.writeUInt16LE(0, 28);
    n.copy(h, 30);
    this.actual = { nombre: n, hora, fecha: dia, crc: 0, tamano: 0, desplazamiento: this.posicion };
    this.posicion += h.length;
    return h;
  }

  /** Suma bytes de datos del archivo en curso (para llevar la cuenta de la posición). */
  datos(bytes: number): void {
    if (!this.actual) throw new Error("ZIP: no hay un archivo abierto");
    this.posicion += bytes;
  }

  cierre(crc: number, tamano: number): Buffer {
    const e = this.actual;
    if (!e) throw new Error("ZIP: no hay un archivo abierto");
    if (tamano > MAX_ZIP32) throw new Error("ZIP: un archivo supera los 4 GB");
    const d = Buffer.alloc(16);
    d.writeUInt32LE(FIRMA_DESCRIPTOR, 0);
    d.writeUInt32LE(crc >>> 0, 4);
    d.writeUInt32LE(tamano, 8);
    d.writeUInt32LE(tamano, 12);
    e.crc = crc >>> 0;
    e.tamano = tamano;
    this.entradas.push(e);
    this.actual = null;
    this.posicion += d.length;
    if (this.posicion > MAX_ZIP32) throw new Error("ZIP: la parte se pasó de 4 GB");
    return d;
  }

  directorioCentral(): Buffer {
    if (this.actual) throw new Error("ZIP: falta cerrar el último archivo");
    const inicio = this.posicion;
    const piezas: Buffer[] = [];
    for (const e of this.entradas) {
      const c = Buffer.alloc(46 + e.nombre.length);
      c.writeUInt32LE(FIRMA_CENTRAL, 0);
      c.writeUInt16LE(VERSION, 4); // hecho con
      c.writeUInt16LE(VERSION, 6); // necesario para abrir
      c.writeUInt16LE(BANDERAS, 8);
      c.writeUInt16LE(0, 10);
      c.writeUInt16LE(e.hora, 12);
      c.writeUInt16LE(e.fecha, 14);
      c.writeUInt32LE(e.crc, 16);
      c.writeUInt32LE(e.tamano, 20);
      c.writeUInt32LE(e.tamano, 24);
      c.writeUInt16LE(e.nombre.length, 28);
      // extra, comentario, disco, atributos internos y externos: 0
      c.writeUInt32LE(e.desplazamiento, 42);
      e.nombre.copy(c, 46);
      piezas.push(c);
    }
    const tamanoCentral = piezas.reduce((s, p) => s + p.length, 0);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(FIRMA_FIN, 0);
    fin.writeUInt16LE(this.entradas.length, 8);
    fin.writeUInt16LE(this.entradas.length, 10);
    fin.writeUInt32LE(tamanoCentral, 12);
    if (inicio > MAX_ZIP32 || inicio + tamanoCentral + 22 > MAX_ZIP32) throw new Error("ZIP: la parte se pasó de 4 GB");
    fin.writeUInt32LE(inicio, 16);
    this.posicion += tamanoCentral + 22;
    return Buffer.concat([...piezas, fin]);
  }
}

export type ArchivoParaZip = {
  nombre: string;
  fecha: Date;
  /** Abre el contenido como flujo de trozos (`null` si ya no existe: se saltea). */
  abrir: () => Promise<AsyncIterable<Uint8Array> | null>;
};

/**
 * Convierte una lista de archivos en el flujo de bytes del ZIP, trozo por trozo (memoria acotada: un trozo del
 * origen a la vez). Mientras cada archivo pasa se calcula su CRC32 y se cuentan sus bytes. Los archivos que
 * `abrir()` devuelve como `null` no entran. Al terminar `resultado` tiene los archivos incluidos y el tamaño.
 */
export async function* zipEnFlujo(
  archivos: Iterable<ArchivoParaZip>,
  resultado: { archivos: number; bytes: number; omitidos: number } = { archivos: 0, bytes: 0, omitidos: 0 },
): AsyncGenerator<Buffer, void, void> {
  const z = new ConstructorZip();
  const lista = [...archivos];
  const nombres = nombresUnicos(lista.map((a) => a.nombre));
  for (let i = 0; i < lista.length; i++) {
    const origen = await lista[i]!.abrir();
    if (!origen) {
      resultado.omitidos++;
      continue;
    }
    yield z.encabezado(nombres[i]!, lista[i]!.fecha);
    let crc = 0;
    let tamano = 0;
    for await (const trozo of origen) {
      if (trozo.length === 0) continue;
      crc = crc32(trozo, crc);
      tamano += trozo.length;
      if (tamano > MAX_ZIP32) throw new Error("ZIP: un archivo supera los 4 GB");
      z.datos(trozo.length);
      yield Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo.buffer, trozo.byteOffset, trozo.byteLength);
    }
    yield z.cierre(crc, tamano);
  }
  yield z.directorioCentral();
  resultado.archivos = z.archivos;
  resultado.bytes = z.posicion;
}

/**
 * Junta un flujo en bloques de EXACTAMENTE `bloque` bytes (el último puede ser más chico): la subida multiparte de
 * R2 exige que todas las partes menos la última midan lo mismo.
 */
export async function* enBloques(flujo: AsyncIterable<Buffer>, bloque: number): AsyncGenerator<Buffer, void, void> {
  let pendiente: Buffer[] = [];
  let largo = 0;
  for await (const b of flujo) {
    let resto: Buffer = b;
    while (largo + resto.length >= bloque) {
      const corte = bloque - largo;
      pendiente.push(resto.subarray(0, corte));
      yield pendiente.length === 1 ? pendiente[0]! :Buffer.concat(pendiente, bloque);
      pendiente = [];
      largo = 0;
      resto = resto.subarray(corte);
    }
    if (resto.length > 0) {
      pendiente.push(resto);
      largo += resto.length;
    }
  }
  if (largo > 0) yield Buffer.concat(pendiente, largo);
}

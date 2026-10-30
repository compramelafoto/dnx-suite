/**
 * Recuperación de tarjetas: el estudio abre un caso, la persona corre el programa en su computadora
 * con el código del caso, y el panel muestra a distancia lo que se va encontrando en la tarjeta.
 * Las fotos completas nunca salen de esa computadora: acá sólo llegan miniaturas y datos.
 * Archivo puro (sin `server-only`): lo usan también las pantallas cliente.
 */

export const RECUPERACION_LABEL = "Recuperación de tarjetas";
export const RECUPERACION_PANEL_ROUTE = "/recuperacion";

/** Versión del programa que se ofrece para descargar. */
export const VERSION_PROGRAMA = "1.0.0";

export const ESTADOS_RECUPERACION = ["ESPERANDO", "ESCANEANDO", "TERMINADO", "ERROR"] as const;
export type EstadoRecuperacion = (typeof ESTADOS_RECUPERACION)[number];

export const TIPOS_ARCHIVO = ["JPEG", "RAW", "HEIC", "VIDEO"] as const;
export type TipoArchivoRecuperado = (typeof TIPOS_ARCHIVO)[number];

export const ETIQUETA_ESTADO: Record<EstadoRecuperacion, string> = {
  ESPERANDO: "Esperando el programa",
  ESCANEANDO: "Leyendo la tarjeta",
  TERMINADO: "Terminado",
  ERROR: "Con error",
};

export const ETIQUETA_TIPO: Record<TipoArchivoRecuperado, string> = {
  JPEG: "Fotos JPG",
  RAW: "Fotos RAW",
  HEIC: "Fotos HEIC",
  VIDEO: "Videos",
};

/** El código para vincular el programa vale una semana desde que se abre el caso. */
export const DIAS_VIGENCIA_CODIGO = 7;
/** Si el programa no da señales en este tiempo mientras lee, el panel avisa que se cortó. */
export const MINUTOS_SIN_SENAL = 3;

export const MAX_TITULO = 80;
export const MAX_NOTAS = 1000;
export const MAX_ARCHIVOS_POR_PEDIDO = 50;
/** Un caso no guarda más que esto: una tarjeta de 256 GB llena de JPG ronda las 25.000 fotos. */
export const MAX_ARCHIVOS_POR_CASO = 60_000;
export const MAX_BYTES_MINIATURA = 512 * 1024;

/** Sin 0/O ni 1/I/L: el código se dicta por teléfono. */
const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function codigoDesdeBytes(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  return s;
}

/** "k7qm 2xpa", "K7QM-2XPA" → "K7QM2XPA"; null si no tiene la forma de un código. */
export function normalizarCodigo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{8}$/.test(s)) return null;
  return s;
}

export function codigoLegible(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

/** "2026:10:12 15:30:22" (como lo guarda la cámara) → "12/10/2026 15:30", o null. */
export function fechaTomaLegible(v: string | null | undefined): string | null {
  const m = v ? /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(v) : null;
  if (!m || m[1] === "0000") return null;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** Día de la toma ("2026-10-12") para agrupar la grilla, o null. */
export function diaDeToma(v: string | null | undefined): string | null {
  const m = v ? /^(\d{4}):(\d{2}):(\d{2})/.exec(v) : null;
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function bytesLegibles(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Comando de una línea para Mac (y Linux): baja el programa y lo corre con el código ya puesto. */
export function comandoMac(baseUrl: string, codigo: string): string {
  return `curl -fsSL ${baseUrl}/api/recuperacion/instalar | sh -s ${codigoLegible(codigo)}`;
}

export type ArchivoEntrante = {
  indice: number;
  tipo: TipoArchivoRecuperado;
  extension: string;
  tamanio: number;
  offset: number;
  ancho: number | null;
  alto: number | null;
  fechaToma: string | null;
  camara: string | null;
  nombreLocal: string;
  bytesMiniatura: number | null;
};

const ENTERO = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;

const TEXTO = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  // sin caracteres de control: vienen de los metadatos de la cámara
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : null;
};

/** Valida un archivo informado por el programa. Lo que no cierra se descarta entero. */
export function validarArchivoEntrante(v: unknown): ArchivoEntrante | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const indice = ENTERO(o.indice, 10_000_000);
  const tamanio = ENTERO(o.tamanio, Number.MAX_SAFE_INTEGER);
  const offset = ENTERO(o.offset, Number.MAX_SAFE_INTEGER);
  const tipo = (TIPOS_ARCHIVO as readonly string[]).includes(o.tipo as string) ? (o.tipo as TipoArchivoRecuperado) : null;
  const extension = typeof o.extension === "string" && /^[a-z0-9]{2,5}$/.test(o.extension) ? o.extension : null;
  const nombreLocal = TEXTO(o.nombreLocal, 120);
  if (indice === null || indice < 1 || tamanio === null || tamanio < 1 || offset === null || !tipo || !extension || !nombreLocal) return null;
  const fecha = TEXTO(o.fechaToma, 25);
  const bytesMiniatura = ENTERO(o.bytesMiniatura, MAX_BYTES_MINIATURA);
  return {
    indice,
    tipo,
    extension,
    tamanio,
    offset,
    ancho: ENTERO(o.ancho, 100_000),
    alto: ENTERO(o.alto, 100_000),
    fechaToma: fecha && /^\d{4}:\d{2}:\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(fecha) ? fecha.slice(0, 19) : null,
    camara: TEXTO(o.camara, 80),
    nombreLocal,
    bytesMiniatura: bytesMiniatura && bytesMiniatura > 0 ? bytesMiniatura : null,
  };
}

import { nombresUnicos } from "./zip";

/**
 * Reglas PURAS de «Recibir todo por correo» (etapa 7, Entrega B): topes, claves de las partes en el R2 privado,
 * partido de los archivos en partes de hasta 1 GB y textos. Sin base ni red.
 */
export const ESTADOS_DESCARGA = ["PENDIENTE", "ARMANDO", "LISTA", "ERROR", "VENCIDA"] as const;
export type EstadoDescarga = (typeof ESTADOS_DESCARGA)[number];

/** Una parte pesa como mucho 1 GB exacto (1.073.741.824 bytes)... */
export const PARTE_MAXIMA = 1_073_741_824;
/** ...y un archivo (un video) de más de 1 GB NO se mete en ningún ZIP: se ofrece para bajarlo suelto, directo. */
/** Bloque de la subida multiparte: todos iguales menos el último; R2 pide al menos 5 MB, acá 16 MB. */
export const BLOQUE_SUBIDA = 16 * 1024 * 1024;
/** Lo que ocupan los encabezados de un archivo (local + descriptor + central) además de su nombre, a favor de la seguridad. */
export const SOBRECARGA_POR_ARCHIVO = 512;
/** 65.535 es la marca de ZIP64 en el registro final: se queda uno por debajo. */
export const MAX_ARCHIVOS_POR_PARTE = 65_534;

export const DIAS_VIGENCIA_DESCARGA = 7;
export const MAX_PEDIDOS_POR_DIA = 3;
/** Una corrida «ARMANDO» sin señales por más de este tiempo se considera muerta y otra la retoma. */
export const MINUTOS_CANDADO = 6;
/** Intentos de armar una parte antes de dejar el pedido en ERROR. */
export const MAX_INTENTOS_PARTE = 3;
/** Vida del enlace firmado de una parte o archivo suelto. */
export const SEGUNDOS_DESCARGA_PARTE = 5 * 60;

export type ArchivoDeEntrega = { id: string; fileName: string; bytes: number };

export type ParteDescarga =
  | { tipo: "ZIP"; n: number; key: string; bytes: number; files: number; estado: "PENDIENTE" | "LISTA"; fileIds: string[]; nombres?: string[] }
  /** Un archivo demasiado grande para un ZIP sin ZIP64: se baja suelto, con su enlace de original. */
  | { tipo: "SUELTO"; n: number; fotoId: string; nombre: string; bytes: number; files: 1; estado: "LISTA" };

/** Clave de una parte: `galerias/<ws>/<galeria>/descargas/<descarga>/parte-<n>.zip`. */
export function claveDeParte(workspaceId: string, galeriaId: string, descargaId: string, n: number): string {
  for (const id of [workspaceId, galeriaId, descargaId]) if (!ID.test(id)) throw new Error("Id inválido para armar la clave de la descarga");
  if (!Number.isInteger(n) || n < 1 || n > 9999) throw new Error("Número de parte inválido");
  return `galerias/${workspaceId}/${galeriaId}/descargas/${descargaId}/parte-${n}.zip`;
}

const ID = /^[A-Za-z0-9_-]{1,100}$/;
const CLAVE_PARTE = /^galerias\/([A-Za-z0-9_-]{1,100})\/([A-Za-z0-9_-]{1,100})\/descargas\/([A-Za-z0-9_-]{1,100})\/parte-([1-9]\d{0,3})\.zip$/;

export function analizarClaveDeParte(clave: unknown): { workspaceId: string; galeriaId: string; descargaId: string; n: number } | null {
  if (typeof clave !== "string") return null;
  const m = CLAVE_PARTE.exec(clave);
  return m ? { workspaceId: m[1]!, galeriaId: m[2]!, descargaId: m[3]!, n: Number(m[4]) } : null;
}

export const esClaveDeParte = (clave: unknown): clave is string => analizarClaveDeParte(clave) !== null;

export type PlanDeDescarga = { partes: ParteDescarga[]; totalFiles: number; totalBytes: number };

/**
 * Reparte los archivos (ya en el orden de la galería) en partes de hasta 1 GB, sin cambiarles el orden:
 * - se llena la parte en curso mientras entre el siguiente archivo (contando la sobrecarga de los encabezados);
 * - un archivo de más de 1 GB (un video) no va en ningún ZIP: queda como «suelto» para bajarlo directo;
 * - uno de 1 GB o menos que con sus encabezados se pasaría del GB va solo en su parte;
 * - una parte nunca pasa de 65.535 archivos.
 */
export function planificarPartes(archivos: readonly ArchivoDeEntrega[], clavePara: (n: number) => string): PlanDeDescarga {
  const partes: ParteDescarga[] = [];
  let n = 0;
  let sueltos = 0;
  let ids: string[] = [];
  let nom: string[] = [];
  let bytes = 0;
  // Nombres sin repetirse entre TODAS las partes: si el cliente las extrae juntas en una carpeta, ninguna pisa a otra.
  const unicos = nombresUnicos(archivos.map((a) => a.fileName));
  const cerrar = () => {
    if (ids.length === 0) return;
    n++;
    partes.push({ tipo: "ZIP", n, key: clavePara(n), bytes, files: ids.length, estado: "PENDIENTE", fileIds: ids, nombres: nom });
    ids = [];
    nom = [];
    bytes = 0;
  };
  for (const [i, a] of archivos.entries()) {
    const peso = Math.max(0, a.bytes) + SOBRECARGA_POR_ARCHIVO + Buffer.byteLength(a.fileName, "utf8") * 2;
    if (a.bytes > PARTE_MAXIMA) {
      cerrar();
      sueltos++;
      partes.push({ tipo: "SUELTO", n: sueltos, fotoId: a.id, nombre: unicos[i]!, bytes: a.bytes, files: 1, estado: "LISTA" });
      continue;
    }
    if (peso > PARTE_MAXIMA) {
      // Grande (video): solo en su parte.
      cerrar();
      ids = [a.id];
      nom = [unicos[i]!];
      bytes = peso;
      cerrar();
      continue;
    }
    if (ids.length > 0 && (bytes + peso > PARTE_MAXIMA || ids.length >= MAX_ARCHIVOS_POR_PARTE)) cerrar();
    ids.push(a.id);
    nom.push(unicos[i]!);
    bytes += peso;
  }
  cerrar();
  return { partes, totalFiles: archivos.length, totalBytes: archivos.reduce((s, a) => s + Math.max(0, a.bytes), 0) };
}

/** Tamaño legible en español: «512 KB», «84,3 MB», «1,02 GB». */
export function formatearBytes(bytes: number): string {
  const n = Math.max(0, bytes);
  const f = (v: number, d: number) => v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (n < 1024 * 1024) return `${f(Math.max(1, Math.round(n / 1024)), 0)} KB`;
  if (n < 1024 ** 3) return `${f(n / 1024 ** 2, 1)} MB`;
  return `${f(n / 1024 ** 3, 2)} GB`;
}

export const ETIQUETA_ESTADO_DESCARGA: Record<EstadoDescarga, string> = {
  PENDIENTE: "En espera",
  ARMANDO: "Armando",
  LISTA: "Lista",
  ERROR: "No se pudo armar",
  VENCIDA: "Vencida",
};

export const MENSAJES_DESCARGA = {
  generico: "No pudimos preparar la descarga. Probá de nuevo en unos minutos.",
  soloEntrega: "La descarga completa sólo está en las galerías de entrega.",
  sinArchivos: "Esta galería todavía no tiene archivos listos.",
  sinCorreo: "No tenemos tu correo. Pedile al estudio que lo cargue y te mandamos la descarga.",
  enCurso: "Ya estamos armando tu descarga. Te avisamos por correo apenas esté lista.",
  tope: "Ya pediste la descarga 3 veces hoy. Probá mañana o escribile al estudio.",
  noDisponible: "Esta descarga ya no está disponible. Pedila de nuevo desde tu galería.",
  parteInvalida: "No encontramos esa parte.",
  sinAlmacenamiento: "El almacenamiento todavía no está configurado.",
} as const;

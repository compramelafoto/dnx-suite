/**
 * El estado del Modo Fotolibro: las fotos del trabajo y qué foto va en cada página de cada pliego.
 *
 * Vive en `metaJson.fotolibro` de la versión, al lado de la medida y la cantidad de hojas. Los
 * bloques del diseño (lo que se imprime) se calculan desde acá con `generarBloques`: este estado
 * es la intención ("estas tres fotos en la página izquierda"), los bloques son el resultado.
 */

/** Una foto del trabajo. `url` es el original (lo que se imprime); `vista` y `mini`, livianas. */
export type FotoDelLibro = {
  id: string;
  url: string;
  vista: string;
  mini: string;
  /** Medidas del original, en píxeles. */
  w: number;
  h: number;
  nombre: string;
};

export type LadoPliego = "izq" | "der";

export type PaginaDelPliego = {
  /** Ids de `fotos`, en orden de lectura. */
  fotos: string[];
  /** Qué variante de acomodo usa: la 0 es la que mejor llena la página. */
  variante: number;
};

export type PliegoDelLibro = { izq: PaginaDelPliego; der: PaginaDelPliego };

export type EstadoFotolibro = {
  fotos: FotoDelLibro[];
  pliegos: PliegoDelLibro[];
  /** Separación entre fotos y margen de la página, en milímetros. */
  separacionMm: number;
  margenMm: number;
};

export const SEPARACION_MM_INICIAL = 4;
export const MARGEN_MM_INICIAL = 12;

const paginaVacia = (): PaginaDelPliego => ({ fotos: [], variante: 0 });
export const pliegoVacio = (): PliegoDelLibro => ({ izq: paginaVacia(), der: paginaVacia() });

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const txt = (v: unknown) => (typeof v === "string" ? v : "");

function leerFoto(raw: unknown): FotoDelLibro | null {
  if (!esObj(raw)) return null;
  const id = txt(raw.id);
  const url = txt(raw.url);
  const w = num(raw.w, 0);
  const h = num(raw.h, 0);
  if (!id || !url || w <= 0 || h <= 0) return null;
  return { id, url, vista: txt(raw.vista) || url, mini: txt(raw.mini) || txt(raw.vista) || url, w, h, nombre: txt(raw.nombre) };
}

function leerPagina(raw: unknown, existentes: Set<string>): PaginaDelPliego {
  if (!esObj(raw)) return paginaVacia();
  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos.filter((f): f is string => typeof f === "string" && existentes.has(f))
    : [];
  // Una foto no se repite dentro de la misma página.
  return { fotos: [...new Set(fotos)], variante: Math.max(0, Math.trunc(num(raw.variante, 0))) };
}

/**
 * Lee el estado guardado. Tolera lo que falte o esté roto: un fotolibro recién creado no tiene
 * fotos ni pliegos cargados, sólo su cantidad de hojas.
 */
export function leerEstadoFotolibro(meta: unknown, cantidadPliegos: number): EstadoFotolibro {
  const fl = esObj(meta) && esObj(meta.fotolibro) ? meta.fotolibro : {};
  const fotos = (Array.isArray(fl.fotos) ? fl.fotos : []).map(leerFoto).filter((f): f is FotoDelLibro => f !== null);
  const ids = new Set(fotos.map((f) => f.id));
  const crudos = Array.isArray(fl.pliegos) ? fl.pliegos : [];
  const pliegos: PliegoDelLibro[] = [];
  for (let i = 0; i < Math.max(1, cantidadPliegos); i++) {
    const p = crudos[i];
    pliegos.push(esObj(p) ? { izq: leerPagina(p.izq, ids), der: leerPagina(p.der, ids) } : pliegoVacio());
  }
  return {
    fotos,
    pliegos,
    separacionMm: Math.min(30, Math.max(0, num(fl.separacionMm, SEPARACION_MM_INICIAL))),
    margenMm: Math.min(40, Math.max(0, num(fl.margenMm, MARGEN_MM_INICIAL))),
  };
}

/** El estado listo para guardar dentro de `metaJson.fotolibro`, sin pisar lo demás que haya ahí. */
export function escribirEstadoFotolibro(meta: Record<string, unknown>, estado: EstadoFotolibro): Record<string, unknown> {
  const anterior = esObj(meta.fotolibro) ? meta.fotolibro : {};
  return {
    ...meta,
    templatePageCount: estado.pliegos.length,
    fotolibro: {
      ...anterior,
      hojas: estado.pliegos.length,
      fotos: estado.fotos,
      pliegos: estado.pliegos,
      separacionMm: estado.separacionMm,
      margenMm: estado.margenMm,
    },
  };
}

/** Cuántas veces está usada cada foto en el libro. */
export function usosPorFoto(estado: EstadoFotolibro): Map<string, number> {
  const usos = new Map<string, number>();
  for (const p of estado.pliegos) {
    for (const id of [...p.izq.fotos, ...p.der.fotos]) usos.set(id, (usos.get(id) ?? 0) + 1);
  }
  return usos;
}

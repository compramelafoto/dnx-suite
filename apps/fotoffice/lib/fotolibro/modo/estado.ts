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
  /** Cuándo se sacó, como lo guardó la cámara ("2026-10-12T21:33:05"), para ordenar. */
  tomada?: string;
  /**
   * Mientras el original sigue subiendo de fondo: su clave en el almacenamiento, para confirmarlo.
   * Una foto con esto todavía no se puede mandar a imprimir.
   */
  claveOriginal?: string;
  /** El original no llegó (se cerró la pestaña a mitad de la subida): hay que volver a subirla. */
  faltaOriginal?: boolean;
};

export type LadoPliego = "izq" | "der";
/** Dónde va una foto: en una página, o en el pliego entero ("todo"). */
export type Lado = LadoPliego | "todo";

/**
 * Cómo se arma un pliego. "pliego" (lo de entrada, como en los diseñadores profesionales): las
 * fotos se distribuyen en las dos páginas juntas, con diseños a sangre y a todo el pliego.
 * "paginas": cada página por su lado.
 */
export type ModoPliego = "pliego" | "paginas";

export type PaginaDelPliego = {
  /** Ids de `fotos`, en orden de lectura. */
  fotos: string[];
  /** Qué variante de acomodo usa: la 0 es la que mejor llena la página. */
  variante: number;
  /**
   * Una distribución propia (una favorita aplicada): el marco de cada foto en proporción del
   * pliego (0 a 1). Manda sobre la variante mientras la cantidad de fotos coincida.
   */
  marcos?: { x: number; y: number; w: number; h: number }[];
};

export type PliegoDelLibro = {
  modo: ModoPliego;
  todo: PaginaDelPliego;
  izq: PaginaDelPliego;
  der: PaginaDelPliego;
  /** Color de fondo propio de este pliego (manda sobre el papel y el fondo del estilo). */
  fondo?: string;
};

/** Las partes del pliego que tienen fotos según su modo. */
export const ladosDe = (p: PliegoDelLibro): Lado[] => (p.modo === "pliego" ? ["todo"] : ["izq", "der"]);

/**
 * El estilo aplicado: cuál es, los fondos ya dibujados a la medida de este libro (uno por tipo de
 * pliego, en el almacenamiento) y lo que se escribió en sus títulos.
 */
export type EstiloAplicado = {
  id: string;
  /** Medida para la que se dibujaron los fondos ("ancho×alto" en mm): si cambia, hay que redibujar. */
  medida: string;
  fondos: Partial<Record<"apertura" | "interior" | "interior-alt" | "cierre", string>>;
  textos: Partial<Record<"titulo" | "subtitulo" | "fecha" | "frase", string>>;
};

/** Encuadre de una foto en su marco, igual que `configJson.crop` de los bloques. */
export type Encuadre = { zoom: number; x: number; y: number };

/**
 * La tapa: qué modelo del laboratorio (ver `lib/fotolibro/tapa/catalogo.ts`) y qué fotos lleva.
 * La contratapa sólo existe en las tapas que la imprimen (flexible, completa).
 */
export type TapaDelLibro = {
  modeloId: string;
  fotoId: string | null;
  encuadre: Encuadre | null;
  contratapaFotoId: string | null;
  contratapaEncuadre: Encuadre | null;
  /** Qué diseño de portada genérico usa (ver `DISENOS_TAPA`). */
  diseno?: string;
  /** Textos propios de la tapa; lo que no esté acá sale del estilo. */
  textos?: { titulo?: string; subtitulo?: string; frase?: string };
};

export type EstadoFotolibro = {
  fotos: FotoDelLibro[];
  pliegos: PliegoDelLibro[];
  estilo: EstiloAplicado | null;
  tapa: TapaDelLibro | null;
  /** Cómo se ordena la tira de fotos (y el armado automático). */
  orden: "fecha" | "nombre" | "subida";
  /** Separación entre fotos y margen de la página, en milímetros. */
  separacionMm: number;
  margenMm: number;
  /** Borde alrededor de cada foto, en mm (0 = sin borde), y su color. */
  bordeMm: number;
  bordeColor: string;
};

export const SEPARACION_MM_INICIAL = 4;
export const MARGEN_MM_INICIAL = 12;

const paginaVacia = (): PaginaDelPliego => ({ fotos: [], variante: 0 });
export const pliegoVacio = (modo: ModoPliego = "pliego"): PliegoDelLibro => ({ modo, todo: paginaVacia(), izq: paginaVacia(), der: paginaVacia() });

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
  return {
    id,
    url,
    vista: txt(raw.vista) || url,
    mini: txt(raw.mini) || txt(raw.vista) || url,
    w,
    h,
    nombre: txt(raw.nombre),
    ...(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(txt(raw.tomada)) ? { tomada: txt(raw.tomada) } : {}),
    ...(txt(raw.claveOriginal) ? { claveOriginal: txt(raw.claveOriginal) } : {}),
    ...(raw.faltaOriginal === true ? { faltaOriginal: true } : {}),
  };
}

function leerEstilo(raw: unknown): EstiloAplicado | null {
  if (!esObj(raw) || !txt(raw.id)) return null;
  const mapa = (v: unknown) =>
    esObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) : {};
  return { id: txt(raw.id), medida: txt(raw.medida), fondos: mapa(raw.fondos), textos: mapa(raw.textos) };
}

function leerEncuadre(raw: unknown): Encuadre | null {
  if (!esObj(raw)) return null;
  return { zoom: Math.max(1, num(raw.zoom, 1)), x: num(raw.x, 0), y: num(raw.y, 0) };
}

function leerTapa(raw: unknown, existentes: Set<string>): TapaDelLibro | null {
  if (!esObj(raw) || !txt(raw.modeloId)) return null;
  const foto = (v: unknown) => (typeof v === "string" && existentes.has(v) ? v : null);
  return {
    modeloId: txt(raw.modeloId),
    fotoId: foto(raw.fotoId),
    encuadre: leerEncuadre(raw.encuadre),
    contratapaFotoId: foto(raw.contratapaFotoId),
    contratapaEncuadre: leerEncuadre(raw.contratapaEncuadre),
    ...(txt(raw.diseno) ? { diseno: txt(raw.diseno) } : {}),
    ...(esObj(raw.textos)
      ? {
          textos: Object.fromEntries(
            (["titulo", "subtitulo", "frase"] as const).filter((k) => typeof (raw.textos as Record<string, unknown>)[k] === "string").map((k) => [k, (raw.textos as Record<string, string>)[k]]),
          ),
        }
      : {}),
  };
}

function leerPagina(raw: unknown, existentes: Set<string>): PaginaDelPliego {
  if (!esObj(raw)) return paginaVacia();
  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos.filter((f): f is string => typeof f === "string" && existentes.has(f))
    : [];
  // Una foto no se repite dentro de la misma página.
  const unicas = [...new Set(fotos)];
  const marcos = Array.isArray(raw.marcos)
    ? raw.marcos.filter((c): c is { x: number; y: number; w: number; h: number } => esObj(c) && ["x", "y", "w", "h"].every((k) => typeof c[k] === "number"))
    : [];
  return {
    fotos: unicas,
    variante: Math.trunc(num(raw.variante, 0)),
    ...(marcos.length && marcos.length === unicas.length ? { marcos: marcos.map(({ x, y, w, h }) => ({ x, y, w, h })) } : {}),
  };
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
    if (!esObj(p)) {
      pliegos.push(pliegoVacio());
      continue;
    }
    const izq = leerPagina(p.izq, ids);
    const der = leerPagina(p.der, ids);
    // Los libros de antes (sin modo) que ya tenían fotos por página siguen así.
    const modo: ModoPliego = p.modo === "pliego" || p.modo === "paginas" ? p.modo : izq.fotos.length || der.fotos.length ? "paginas" : "pliego";
    const fondo = typeof p.fondo === "string" && /^#[0-9a-f]{6}$/i.test(p.fondo) ? p.fondo : undefined;
    pliegos.push({ modo, todo: leerPagina(p.todo, ids), izq, der, ...(fondo ? { fondo } : {}) });
  }
  return {
    fotos,
    pliegos,
    estilo: leerEstilo(fl.estilo),
    tapa: leerTapa(fl.tapa, ids),
    orden: fl.orden === "nombre" || fl.orden === "subida" ? fl.orden : "fecha",
    separacionMm: Math.min(30, Math.max(0, num(fl.separacionMm, SEPARACION_MM_INICIAL))),
    margenMm: Math.min(40, Math.max(0, num(fl.margenMm, MARGEN_MM_INICIAL))),
    bordeMm: Math.min(10, Math.max(0, num(fl.bordeMm, 0))),
    bordeColor: typeof fl.bordeColor === "string" && /^#[0-9a-f]{6}$/i.test(fl.bordeColor) ? fl.bordeColor : "#ffffff",
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
      estilo: estado.estilo,
      tapa: estado.tapa,
      orden: estado.orden,
      separacionMm: estado.separacionMm,
      margenMm: estado.margenMm,
      bordeMm: estado.bordeMm,
      bordeColor: estado.bordeColor,
    },
  };
}

/** Las fotos puestas en el libro (pliegos y tapa) cuyo original todavía no está para imprimir. */
export function fotosSinOriginal(estado: EstadoFotolibro): FotoDelLibro[] {
  const usadas = usosPorFoto(estado);
  return estado.fotos.filter((f) => (f.claveOriginal || f.faltaOriginal) && usadas.has(f.id));
}

/** Cuántas veces está usada cada foto en el libro. */
export function usosPorFoto(estado: EstadoFotolibro): Map<string, number> {
  const usos = new Map<string, number>();
  for (const p of estado.pliegos) {
    for (const lado of ladosDe(p)) for (const id of p[lado].fotos) usos.set(id, (usos.get(id) ?? 0) + 1);
  }
  for (const id of [estado.tapa?.fotoId, estado.tapa?.contratapaFotoId]) {
    if (id) usos.set(id, (usos.get(id) ?? 0) + 1);
  }
  return usos;
}

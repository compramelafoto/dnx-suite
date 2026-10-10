import { normalizeName } from "./profile";

/**
 * Piezas para imprimir (etapa 4): medidas y diagramación, sin dibujar nada. Todo en milímetros
 * con el origen abajo a la izquierda (como el PDF); las letras, en puntos.
 */
export type SizeMm = { width: number; height: number };
export type PixelSize = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };
type SizeDef = SizeMm & { label: string };

const has = (o: object, v: unknown) => typeof v === "string" && Object.prototype.hasOwnProperty.call(o, v);

export const FRAME_SIZES = {
  A4: { width: 210, height: 297, label: "A4 (21 × 29,7 cm)" },
  A3: { width: 297, height: 420, label: "A3 (29,7 × 42 cm)" },
  "30x40": { width: 300, height: 400, label: "30 × 40 cm" },
  "40x50": { width: 400, height: 500, label: "40 × 50 cm" },
  "50x70": { width: 500, height: 700, label: "50 × 70 cm" },
} as const satisfies Record<string, SizeDef>;
export type FrameSize = keyof typeof FRAME_SIZES;
export const isFrameSize = (v: unknown): v is FrameSize => has(FRAME_SIZES, v);

export const POSTER_SIZES = {
  A3: { width: 297, height: 420, label: "A3 (29,7 × 42 cm)" },
  A2: { width: 420, height: 594, label: "A2 (42 × 59,4 cm)" },
  "50x70": { width: 500, height: 700, label: "50 × 70 cm" },
} as const satisfies Record<string, SizeDef>;
export type PosterSize = keyof typeof POSTER_SIZES;
export const isPosterSize = (v: unknown): v is PosterSize => has(POSTER_SIZES, v);

export const CATALOG_SIZES = {
  A5: { width: 148, height: 210, label: "A5 (14,8 × 21 cm)" },
  A4: { width: 210, height: 297, label: "A4 (21 × 29,7 cm)" },
} as const satisfies Record<string, SizeDef>;
export type CatalogSize = keyof typeof CATALOG_SIZES;
export const isCatalogSize = (v: unknown): v is CatalogSize => has(CATALOG_SIZES, v);

export const GUESTBOOK_POSTER_SIZES = {
  A4: { width: 210, height: 297, label: "A4 (21 × 29,7 cm)" },
  A3: { width: 297, height: 420, label: "A3 (29,7 × 42 cm)" },
} as const satisfies Record<string, SizeDef>;
export type GuestbookPosterSize = keyof typeof GUESTBOOK_POSTER_SIZES;
export const isGuestbookPosterSize = (v: unknown): v is GuestbookPosterSize => has(GUESTBOOK_POSTER_SIZES, v);

export const ORIENTATIONS = ["AUTO", "PORTRAIT", "LANDSCAPE"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];
export const ORIENTATION_LABELS: Record<Orientation, string> = {
  AUTO: "Según la foto",
  PORTRAIT: "Vertical",
  LANDSCAPE: "Horizontal",
};
export const isOrientation = (v: unknown): v is Orientation => (ORIENTATIONS as readonly unknown[]).includes(v);

/** Automática: horizontal sólo si la foto es más ancha que alta. Cuadrada o sin dato, vertical. */
export function resolveOrientation(o: Orientation, image: PixelSize | null): "PORTRAIT" | "LANDSCAPE" {
  if (o !== "AUTO") return o;
  return image && image.width > image.height ? "LANDSCAPE" : "PORTRAIT";
}

export function orientedPage(size: SizeMm, o: "PORTRAIT" | "LANDSCAPE"): SizeMm {
  const corto = Math.min(size.width, size.height);
  const largo = Math.max(size.width, size.height);
  return o === "LANDSCAPE" ? { width: largo, height: corto } : { width: corto, height: largo };
}

/** La imagen entera dentro de la caja (nunca se recorta una obra), centrada. */
export function fitInside(box: Box, img: PixelSize): Box {
  const scale = Math.min(box.width / img.width, box.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/** Margen del remarco respecto del lado corto del papel (arriba y a los costados). */
export const FRAME_MARGIN_RATIO = 0.12;
/** El margen de abajo es más ancho: ahí van título y autor, y compensa el peso visual. */
export const FRAME_BOTTOM_FACTOR = 1.6;

export type FrameLayout = {
  page: SizeMm;
  orientation: "PORTRAIT" | "LANDSCAPE";
  margin: number;
  /** Lo que queda adentro de los márgenes. */
  window: Box;
  /** Donde va la foto (o la ventana marcada, en "sólo el remarco"). */
  image: Box;
  /** Altura (mm) desde donde empieza a bajar el pie con título y autor. */
  captionTop: number;
  titleSizePt: number;
  authorSizePt: number;
};

export function frameLayout(size: FrameSize, orientation: Orientation, image: PixelSize | null): FrameLayout {
  const valida = image && image.width > 0 && image.height > 0 ? image : null;
  const o = resolveOrientation(orientation, valida);
  const page = orientedPage(FRAME_SIZES[size], o);
  const corto = Math.min(page.width, page.height);
  const margin = corto * FRAME_MARGIN_RATIO;
  const abajo = margin * FRAME_BOTTOM_FACTOR;
  const window: Box = { x: margin, y: abajo, width: page.width - 2 * margin, height: page.height - margin - abajo };
  const img = valida ? fitInside(window, valida) : window;
  // 13 pt en A4, proporcional al papel, entre 11 y 28.
  const titleSizePt = Math.min(28, Math.max(11, (corto / 210) * 13));
  return {
    page, orientation: o, margin, window, image: img,
    captionTop: img.y - margin * 0.25,
    titleSizePt, authorSizePt: titleSizePt * 0.75,
  };
}

/** Puntos por pulgada con que sale la foto en la caja (el menor de los dos lados). */
export function printPpi(img: PixelSize, box: Box): number {
  if (!(box.width > 0 && box.height > 0)) return 0;
  return Math.floor(Math.min(img.width / (box.width / 25.4), img.height / (box.height / 25.4)));
}

export type PrintQuality = "GOOD" | "FAIR" | "LOW";
export const QUALITY_LABELS: Record<PrintQuality, string> = {
  GOOD: "buena calidad",
  FAIR: "calidad aceptable",
  LOW: "se va a ver blanda",
};
export function printQuality(ppi: number): PrintQuality {
  if (ppi >= 200) return "GOOD";
  if (ppi >= 120) return "FAIR";
  return "LOW";
}

/**
 * Lado mayor de las fotos de obra que guardamos (`LADO_MAYOR.obra` en
 * `apps/muestras/lib/imagenes/procesar.ts`). Los originales en alta llegan con Ventas.
 */
export const WEB_IMAGE_LONG_SIDE = 2000;
/** Una foto 3:2 (la de casi toda cámara) del tamaño que guardamos. */
export const TYPICAL_IMAGE: PixelSize = { width: WEB_IMAGE_LONG_SIDE, height: 1333 };

/** La calidad que se puede esperar en cada medida con las fotos que guardamos. */
export function expectedQuality(size: FrameSize): PrintQuality {
  const l = frameLayout(size, "AUTO", TYPICAL_IMAGE);
  return printQuality(printPpi(TYPICAL_IMAGE, l.image));
}

/** El primero de `sizes` (de mayor a menor) para el que `fits` da true; si ninguno, el último. */
export function largestThatFits(sizes: readonly number[], fits: (size: number) => boolean): number {
  if (sizes.length === 0) throw new Error("largestThatFits necesita al menos una medida.");
  for (const s of sizes) if (fits(s)) return s;
  return sizes[sizes.length - 1]!;
}

export type CatalogPlan = {
  coverPage: 1;
  curatorialFirstPage: number | null;
  firstWorkPage: number;
  indexFirstPage: number;
  closingPage: number;
  totalPages: number;
};

/** Portada, texto curatorial (N páginas), una por obra, índice (M páginas) y cierre con QR. */
export function catalogPlan(curatorialPages: number, works: number, indexPages: number): CatalogPlan {
  const firstWorkPage = 2 + curatorialPages;
  const indexFirstPage = firstWorkPage + works;
  const closingPage = indexFirstPage + Math.max(1, indexPages);
  return {
    coverPage: 1,
    curatorialFirstPage: curatorialPages > 0 ? 2 : null,
    firstWorkPage, indexFirstPage, closingPage, totalPages: closingPage,
  };
}

export type AuthorIndexEntry = { author: string; pages: number[] };

/** Páginas seguidas en rangos: [3, 4, 5, 9, 11, 12] → "3–5, 9, 11–12". Entrada ordenada. */
export function pageRanges(pages: readonly number[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j]! + 1) j += 1;
    out.push(j > i ? `${pages[i]}–${pages[j]}` : String(pages[i]));
    i = j + 1;
  }
  return out.join(", ");
}
export const NO_AUTHOR = "Autor sin indicar";

/**
 * Índice alfabético de autores con sus páginas. "Ana Pérez" y "ana perez" son la misma persona
 * (se muestra la primera forma que aparece). Las obras sin autor van al final.
 */
export function authorIndex(entries: ReadonlyArray<{ authorName: string; page: number }>): AuthorIndexEntry[] {
  const grupos = new Map<string, AuthorIndexEntry>();
  const sinAutor: number[] = [];
  for (const e of entries) {
    const clave = normalizeName(e.authorName);
    if (!clave) {
      sinAutor.push(e.page);
      continue;
    }
    const g = grupos.get(clave);
    if (g) g.pages.push(e.page);
    else grupos.set(clave, { author: e.authorName.trim(), pages: [e.page] });
  }
  const orden = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, "es", { sensitivity: "base" })).map(([, g]) => g);
  for (const g of orden) g.pages.sort((a, b) => a - b);
  return sinAutor.length ? [...orden, { author: NO_AUTHOR, pages: sinAutor.sort((a, b) => a - b) }] : orden;
}

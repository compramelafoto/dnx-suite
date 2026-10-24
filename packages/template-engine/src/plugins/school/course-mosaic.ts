/**
 * Mosaico del curso: los retratos chicos de los compañeros del dueño del diseño, cada uno con su
 * nombre, repartidos solos dentro de un rectángulo.
 *
 * Como el «Listado del curso», es un bloque de dato variable (`VARIABLE_TEXT`) con su propia
 * clave, `course.mosaic`, y no un tipo de bloque nuevo: un tipo nuevo exige migrar el enum en
 * todas las bases, y el bloque de dato variable ya trae lo tipográfico que usan los nombres.
 *
 * La lista viaja como JSON dentro del valor (`serializeCourseMosaic`). Quien arma el valor ya
 * saca al dueño: el mosaico de la carpeta de Juan no lleva a Juan. El lienzo del editor, la vista
 * previa y la impresión reparten con `layoutCourseMosaic`, la misma cuenta en los tres lados.
 */

export const COURSE_MOSAIC_VARIABLE_KEY = "course.mosaic";

export type CourseMosaicCrop = { zoom: number; x: number; y: number };

export type CourseMosaicStudent = {
  firstName: string;
  lastName: string;
  /** Foto real del álbum: la imprime el render de CLF. */
  photoId?: number;
  /** Para pantalla y demo: la dirección pública de la foto (o de su versión con marca de agua). */
  photoUrl?: string;
  /** Encuadre de la cara dentro del recuadro. */
  crop?: CourseMosaicCrop;
  /** Ancho ÷ alto de la foto original, para ubicar el encuadre en pantalla. */
  sourceAspect?: number;
};

export type CourseMosaicFrame = "rect" | "rounded" | "circle" | "ellipse" | "polaroid";
export type CourseMosaicNamePosition = "below" | "above" | "insideBottom" | "none";

export type CourseMosaicOptions = {
  frame: CourseMosaicFrame;
  /** Radio de esquina en píxeles del lienzo; sólo con `rounded`. */
  cornerRadius: number;
  /** Ancho ÷ alto del retrato. 0,75 es el 3:4 de la foto carné. */
  photoAspect: number;
  /** Separación entre retratos, en píxeles del lienzo. 0 = pegados. */
  gapX: number;
  gapY: number;
  borderWidth: number;
  borderColor: string;
  /** Sombra sólida corrida, como el recuadro de color detrás de cada foto. null = sin sombra. */
  shadow: { dx: number; dy: number; color: string } | null;
  /** Giro alternado en grados: 3 = +3°, −3°, +3°… (fotos pegadas a mano). 0 = derechas. */
  tilt: number;
  /** Imagen de marco (PNG con transparencia) encima de cada retrato. Vacío = sin marco. */
  frameSrc: string;
  namePosition: CourseMosaicNamePosition;
  /** 2 = el nombre arriba y el apellido abajo. */
  nameLines: 1 | 2;
  /** Color de la cinta detrás del nombre. Vacío = sin cinta. */
  nameBackground: string;
  sortBy: "firstName" | "lastName";
  /** Todos los nombres ("María Sol") o sólo el primero ("María"). */
  givenNames: "all" | "first";
  /** Dónde va la última fila cuando no se llena. */
  lastRowAlign: "left" | "center" | "right";
  /** Zona libre para un cartel, en proporciones del bloque (0 a 1). null = sin zona. */
  reserved: { x: number; y: number; width: number; height: number } | null;
  /**
   * Orden en la cadena de bloques: los chicos llenan el 1, siguen en el 2… Sirve para un mosaico
   * que esquiva un cartel o que se parte entre dos páginas.
   */
  chainOrder: number;
  /** Cuántos chicos entran como máximo en este bloque de la cadena. 0 = sin tope. */
  capacity: number;
};

export const DEFAULT_COURSE_MOSAIC_OPTIONS: CourseMosaicOptions = {
  frame: "rect",
  cornerRadius: 12,
  photoAspect: 0.75,
  gapX: 16,
  gapY: 16,
  borderWidth: 0,
  borderColor: "#ffffff",
  shadow: null,
  tilt: 0,
  frameSrc: "",
  namePosition: "below",
  nameLines: 2,
  nameBackground: "",
  sortBy: "lastName",
  givenNames: "first",
  lastRowAlign: "center",
  reserved: null,
  chainOrder: 1,
  capacity: 0,
};

export const COURSE_MOSAIC_PHOTO_ASPECT_MIN = 0.2;
export const COURSE_MOSAIC_PHOTO_ASPECT_MAX = 5;
export const COURSE_MOSAIC_TILT_MAX = 10;
/** Hasta dónde se achica un nombre largo antes de cortarlo con «…». */
export const COURSE_MOSAIC_NAME_MIN_SCALE = 0.6;
/** Ancho medio de una letra como fracción del cuerpo: la misma estimación en todos los lados. */
export const COURSE_MOSAIC_CHAR_WIDTH = 0.55;

const FRAMES: readonly CourseMosaicFrame[] = ["rect", "rounded", "circle", "ellipse", "polaroid"];
const NAME_POSITIONS: readonly CourseMosaicNamePosition[] = ["below", "above", "insideBottom", "none"];

const MAX_COLUMNS = 14;
const MAX_ROWS = 40;

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function isCourseMosaicConfig(config: unknown): boolean {
  return rec(config)?.variableKey === COURSE_MOSAIC_VARIABLE_KEY;
}

function readShadow(v: unknown): CourseMosaicOptions["shadow"] {
  const s = rec(v);
  if (!s) return null;
  const dx = finite(s.dx);
  const dy = finite(s.dy);
  const color = typeof s.color === "string" ? s.color.trim() : "";
  if (dx == null || dy == null || !color) return null;
  return { dx, dy, color };
}

function readReserved(v: unknown): CourseMosaicOptions["reserved"] {
  const r = rec(v);
  if (!r) return null;
  const x = finite(r.x);
  const y = finite(r.y);
  const width = finite(r.width);
  const height = finite(r.height);
  if (x == null || y == null || width == null || height == null) return null;
  const z = { x: clamp(x, 0, 1), y: clamp(y, 0, 1), width: clamp(width, 0, 1), height: clamp(height, 0, 1) };
  return z.width > 0 && z.height > 0 ? z : null;
}

/** Las opciones guardadas en `configJson.courseMosaic`, con los valores por defecto donde falten. */
export function readCourseMosaicOptions(config: unknown): CourseMosaicOptions {
  const raw = rec(rec(config)?.courseMosaic) ?? {};
  const d = DEFAULT_COURSE_MOSAIC_OPTIONS;
  const num = (v: unknown, def: number, min: number, max: number) => {
    const n = finite(v);
    return n == null ? def : clamp(n, min, max);
  };
  const str = (v: unknown, def: string) => (typeof v === "string" ? v.trim() : def);
  const pick = <T extends string>(v: unknown, list: readonly T[], def: T): T =>
    list.includes(v as T) ? (v as T) : def;
  return {
    frame: pick(raw.frame, FRAMES, d.frame),
    cornerRadius: num(raw.cornerRadius, d.cornerRadius, 0, 10_000),
    photoAspect: num(raw.photoAspect, d.photoAspect, COURSE_MOSAIC_PHOTO_ASPECT_MIN, COURSE_MOSAIC_PHOTO_ASPECT_MAX),
    gapX: num(raw.gapX, d.gapX, 0, 10_000),
    gapY: num(raw.gapY, d.gapY, 0, 10_000),
    borderWidth: num(raw.borderWidth, d.borderWidth, 0, 1_000),
    borderColor: str(raw.borderColor, d.borderColor) || d.borderColor,
    shadow: raw.shadow === undefined ? d.shadow : readShadow(raw.shadow),
    tilt: num(raw.tilt, d.tilt, 0, COURSE_MOSAIC_TILT_MAX),
    frameSrc: str(raw.frameSrc, d.frameSrc),
    namePosition: pick(raw.namePosition, NAME_POSITIONS, d.namePosition),
    nameLines: raw.nameLines === 1 || raw.nameLines === 2 ? raw.nameLines : d.nameLines,
    nameBackground: str(raw.nameBackground, d.nameBackground),
    sortBy: pick(raw.sortBy, ["firstName", "lastName"] as const, d.sortBy),
    givenNames: pick(raw.givenNames, ["all", "first"] as const, d.givenNames),
    lastRowAlign: pick(raw.lastRowAlign, ["left", "center", "right"] as const, d.lastRowAlign),
    reserved: raw.reserved === undefined ? d.reserved : readReserved(raw.reserved),
    chainOrder: Math.round(num(raw.chainOrder, d.chainOrder, 1, 99)),
    capacity: Math.round(num(raw.capacity, d.capacity, 0, 999)),
  };
}

export function serializeCourseMosaic(students: CourseMosaicStudent[]): string {
  return JSON.stringify(students);
}

function readStudent(v: unknown): CourseMosaicStudent | null {
  const r = rec(v);
  if (!r) return null;
  const firstName = typeof r.firstName === "string" ? r.firstName.trim() : "";
  const lastName = typeof r.lastName === "string" ? r.lastName.trim() : "";
  if (!firstName && !lastName) return null;
  const s: CourseMosaicStudent = { firstName, lastName };
  const photoId = finite(r.photoId);
  if (photoId != null && Number.isInteger(photoId) && photoId > 0) s.photoId = photoId;
  if (typeof r.photoUrl === "string" && r.photoUrl.trim()) s.photoUrl = r.photoUrl.trim();
  const crop = rec(r.crop);
  if (crop) {
    const zoom = finite(crop.zoom);
    const x = finite(crop.x);
    const y = finite(crop.y);
    if (zoom != null && x != null && y != null) s.crop = { zoom, x, y };
  }
  const aspect = finite(r.sourceAspect);
  if (aspect != null && aspect > 0) s.sourceAspect = aspect;
  return s;
}

/** Los chicos del valor guardado. Un valor vacío o roto es un mosaico sin chicos. */
export function parseCourseMosaic(value: string | null | undefined): CourseMosaicStudent[] {
  if (!value || !value.trim()) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(readStudent).filter((s): s is CourseMosaicStudent => s != null);
}

export function sortCourseMosaic(students: CourseMosaicStudent[], o: CourseMosaicOptions): CourseMosaicStudent[] {
  const key = (s: CourseMosaicStudent) =>
    o.sortBy === "lastName" ? [s.lastName, s.firstName] : [s.firstName, s.lastName];
  return [...students].sort((a, b) => {
    const [a1, a2] = key(a);
    const [b1, b2] = key(b);
    return a1!.localeCompare(b1!, "es", { sensitivity: "base" }) || a2!.localeCompare(b2!, "es", { sensitivity: "base" });
  });
}

/** Cómo se escribe cada chico: una línea («María Pérez») o dos («María» / «Pérez»). */
export function formatMosaicName(s: CourseMosaicStudent, o: CourseMosaicOptions): string[] {
  const given = o.givenNames === "first" ? (s.firstName.split(/\s+/)[0] ?? "") : s.firstName;
  const parts = [given, s.lastName].filter(Boolean);
  return o.nameLines === 1 ? [parts.join(" ")] : parts;
}

/** Compañeros de muestra, sin fotos: lo que muestra el editor antes de tener un curso real. */
export const COURSE_MOSAIC_SAMPLE: CourseMosaicStudent[] = [
  ["Valentina", "Acosta"],
  ["Mateo", "Benítez"],
  ["Sofía", "Cabrera"],
  ["Benjamín", "Díaz"],
  ["Isabella", "Escobar"],
  ["Thiago", "Fernández"],
  ["Emma", "Giménez"],
  ["Bautista", "Herrera"],
  ["Martina", "Ibáñez"],
  ["Santino", "Juárez"],
  ["Catalina", "López"],
  ["Felipe", "Medina"],
  ["Olivia", "Núñez"],
  ["Joaquín", "Ortiz"],
  ["Mía", "Pereyra"],
  ["Lautaro", "Quiroga"],
  ["Julieta", "Romero"],
  ["Tomás", "Sosa"],
  ["Renata", "Torres"],
  ["Lorenzo", "Urquiza"],
  ["Delfina", "Vega"],
  ["Facundo", "Zárate"],
  ["Alma", "Aguirre"],
  ["Ignacio", "Blanco"],
].map(([firstName, lastName]) => ({ firstName: firstName!, lastName: lastName! }));

export type CourseMosaicRect = { x: number; y: number; width: number; height: number };

export type CourseMosaicCell = {
  student: CourseMosaicStudent;
  /** La celda entera (foto, nombre y el papel de la polaroid), relativa al bloque y sin girar. */
  box: CourseMosaicRect;
  /** El retrato. */
  photo: CourseMosaicRect;
  /** El nombre ya cortado en líneas y con su cuerpo; null si el mosaico va sin nombres. */
  name: (CourseMosaicRect & { lines: string[]; fontSize: number }) | null;
  /** Giro propio de la celda, en grados. */
  rotation: number;
};

type Geometry = {
  /** Tamaño de la celda entera para un ancho de foto. */
  cell: (pw: number) => { w: number; h: number };
};

function geometry(o: CourseMosaicOptions, fontSize: number, lineHeight: number): Geometry & { labelH: number } {
  const lines = o.namePosition === "none" ? 0 : o.nameLines;
  const textH = lines * fontSize * lineHeight;
  const labelH = lines ? textH + fontSize * 0.4 : 0;
  if (o.frame === "polaroid") {
    return {
      labelH,
      cell: (pw) => {
        const pad = pw * 0.06;
        const bottom = Math.max(pad * 3, labelH + pad);
        return { w: pw + 2 * pad, h: pw / o.photoAspect + pad + bottom };
      },
    };
  }
  const outside = o.namePosition === "below" || o.namePosition === "above" ? labelH : 0;
  return { labelH, cell: (pw) => ({ w: pw, h: pw / o.photoAspect + outside }) };
}

/** El ancho de foto más grande con el que entra una grilla de `cols` × `rows`. */
function largestPhotoWidth(g: Geometry, cols: number, rows: number, w: number, h: number, o: CourseMosaicOptions) {
  const fits = (pw: number) => {
    const c = g.cell(pw);
    return cols * c.w + (cols - 1) * o.gapX <= w + 1e-6 && rows * c.h + (rows - 1) * o.gapY <= h + 1e-6;
  };
  let lo = 0;
  let hi = Math.max(w, h);
  if (!fits(lo)) return 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

type Grid = { cols: number; rows: number; pw: number; cellW: number; cellH: number; x0: number; y0: number };

function cellBox(grid: Grid, row: number, col: number, o: CourseMosaicOptions): CourseMosaicRect {
  return {
    x: grid.x0 + col * (grid.cellW + o.gapX),
    y: grid.y0 + row * (grid.cellH + o.gapY),
    width: grid.cellW,
    height: grid.cellH,
  };
}

function cuts(a: CourseMosaicRect, z: CourseMosaicRect) {
  const e = 1e-6;
  return a.x < z.x + z.width - e && z.x < a.x + a.width - e && a.y < z.y + z.height - e && z.y < a.y + a.height - e;
}

/** Las celdas libres de una grilla, fila por fila, sin las que cortan la zona del cartel. */
function freeCells(grid: Grid, zone: CourseMosaicRect | null, o: CourseMosaicOptions) {
  const out: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (zone && cuts(cellBox(grid, row, col, o), zone)) continue;
      out.push({ row, col });
    }
  }
  return out;
}

function makeGrid(g: Geometry, cols: number, rows: number, pw: number, w: number, h: number, o: CourseMosaicOptions): Grid {
  const c = g.cell(pw);
  const gw = cols * c.w + (cols - 1) * o.gapX;
  const gh = rows * c.h + (rows - 1) * o.gapY;
  return { cols, rows, pw, cellW: c.w, cellH: c.h, x0: (w - gw) / 2, y0: (h - gh) / 2 };
}

/** Un nombre que entra en su ancho: se achica hasta un mínimo y después se corta con «…». */
function fitName(lines: string[], width: number, fontSize: number) {
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const needed = COURSE_MOSAIC_CHAR_WIDTH * fontSize * longest;
  const size = needed <= width ? fontSize : Math.max(fontSize * COURSE_MOSAIC_NAME_MIN_SCALE, (fontSize * width) / needed);
  const maxChars = Math.max(1, Math.floor(width / (COURSE_MOSAIC_CHAR_WIDTH * size) + 1e-9));
  return {
    fontSize: size,
    lines: lines.map((l) => (l.length <= maxChars ? l : `${l.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`)),
  };
}

/**
 * Reparte los chicos de un bloque: elige la grilla que deja los retratos más grandes, salta la
 * zona del cartel y alinea la última fila. Los chicos llegan ya ordenados y sin el dueño.
 */
export function layoutCourseMosaic(input: {
  students: CourseMosaicStudent[];
  options: CourseMosaicOptions;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
}): { cells: CourseMosaicCell[]; overflow: number } {
  const { students, options: o, width: w, height: h, fontSize, lineHeight } = input;
  const n = students.length;
  if (n === 0 || w <= 0 || h <= 0) return { cells: [], overflow: n };
  const g = geometry(o, fontSize, lineHeight);
  const zone = o.reserved
    ? { x: o.reserved.x * w, y: o.reserved.y * h, width: o.reserved.width * w, height: o.reserved.height * h }
    : null;

  let best: { grid: Grid; free: Array<{ row: number; col: number }> } | null = null;
  for (let cols = 1; cols <= Math.min(Math.max(n, 1), MAX_COLUMNS); cols++) {
    for (let rows = Math.ceil(n / cols); rows <= MAX_ROWS; rows++) {
      const pw = largestPhotoWidth(g, cols, rows, w, h, o);
      if (pw <= 0) break;
      const grid = makeGrid(g, cols, rows, pw, w, h, o);
      const free = freeCells(grid, zone, o);
      if (free.length >= n) {
        if (!best || pw > best.grid.pw + 1e-9) best = { grid, free };
        break;
      }
    }
  }
  if (!best) return { cells: [], overflow: n };

  const { grid, free } = best;
  const used = free.slice(0, n);
  const lastRow = used[used.length - 1]!.row;
  const inLast = used.filter((c) => c.row === lastRow).length;
  const lastRowIsClean = !zone || free.filter((c) => c.row === lastRow).length === grid.cols;
  const spare = grid.cols - inLast;
  const shift =
    lastRowIsClean && spare > 0 && o.lastRowAlign !== "left"
      ? ((o.lastRowAlign === "center" ? spare / 2 : spare) * (grid.cellW + o.gapX))
      : 0;

  const pad = o.frame === "polaroid" ? grid.pw * 0.06 : 0;
  const ph = grid.pw / o.photoAspect;
  const textH = o.nameLines * fontSize * lineHeight;

  const cells = used.map(({ row, col }, i): CourseMosaicCell => {
    const box = cellBox(grid, row, col, o);
    if (row === lastRow) box.x += shift;
    const student = students[i]!;
    let photo: CourseMosaicRect;
    let nameRect: CourseMosaicRect | null = null;
    if (o.frame === "polaroid") {
      photo = { x: box.x + pad, y: box.y + pad, width: grid.pw, height: ph };
      if (o.namePosition !== "none") {
        const bottomTop = photo.y + ph;
        const bottomH = box.y + box.height - bottomTop;
        nameRect = { x: photo.x, y: bottomTop + (bottomH - textH) / 2, width: grid.pw, height: textH };
      }
    } else if (o.namePosition === "above") {
      photo = { x: box.x, y: box.y + g.labelH, width: grid.pw, height: ph };
      nameRect = { x: box.x, y: box.y, width: grid.pw, height: textH };
    } else {
      photo = { x: box.x, y: box.y, width: grid.pw, height: ph };
      if (o.namePosition === "below") nameRect = { x: box.x, y: box.y + ph + fontSize * 0.4, width: grid.pw, height: textH };
      else if (o.namePosition === "insideBottom") {
        nameRect = { x: box.x, y: box.y + ph - textH - fontSize * 0.3, width: grid.pw, height: textH };
      }
    }
    const name = nameRect ? { ...nameRect, ...fitName(formatMosaicName(student, o), nameRect.width, fontSize) } : null;
    const rotation = o.tilt === 0 ? 0 : i % 2 === 0 ? o.tilt : -o.tilt;
    return { student, box, photo, name, rotation };
  });
  return { cells, overflow: 0 };
}

/**
 * Reparte los chicos entre los bloques encadenados, por `chainOrder`; el último eslabón se lleva el
 * resto. Los bloques con el mismo orden son copias (por ejemplo, el mismo mosaico en dos
 * páginas): cada uno lleva a los mismos chicos.
 */
export function splitCourseMosaicChain<T extends { id: string; options: CourseMosaicOptions }>(
  blocks: T[],
  students: CourseMosaicStudent[],
): Map<string, CourseMosaicStudent[]> {
  const orders = [...new Set(blocks.map((b) => b.options.chainOrder))].sort((a, b) => a - b);
  const out = new Map<string, CourseMosaicStudent[]>();
  let next = 0;
  orders.forEach((order, i) => {
    const link = blocks.filter((b) => b.options.chainOrder === order);
    const capacity = link[0]!.options.capacity;
    const isLast = i === orders.length - 1;
    const take = isLast || capacity === 0 ? students.length - next : capacity;
    const slice = students.slice(next, next + take);
    for (const b of link) out.set(b.id, slice);
    next = Math.min(students.length, next + take);
  });
  return out;
}

/**
 * Los chicos de cada bloque mosaico de un diseño: se ordenan con las opciones del primer bloque
 * de la cadena y se reparten por `chainOrder`. Lo usan el lienzo y la impresión, así los dos
 * ponen a cada chico en el mismo bloque.
 */
export function distributeCourseMosaic(
  blocks: ReadonlyArray<{ id: string; configJson?: unknown }>,
  students: CourseMosaicStudent[],
): Map<string, CourseMosaicStudent[]> {
  const chain = blocks
    .filter((b) => isCourseMosaicConfig(b.configJson))
    .map((b) => ({ id: b.id, options: readCourseMosaicOptions(b.configJson) }));
  if (chain.length === 0) return new Map();
  const first = [...chain].sort((a, b) => a.options.chainOrder - b.options.chainOrder)[0]!;
  return splitCourseMosaicChain(chain, sortCourseMosaic(students, first.options));
}
